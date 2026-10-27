"""
Evaluate existing offshore-platform XGBoost model artifacts.

IMPORTANT:
- This script evaluates the EXISTING .pkl models; it does not retrain them.
- If the final models were trained using the same historical projects (directly
  or through synthetic data generated from them), evaluating on those projects
  is an IN-SAMPLE / apparent-performance check, not an unbiased test-set score.
- For a thesis-quality independent test, provide a separate TEST_FILE containing
  projects that were not used to create the training/synthetic data.

Metrics:
    R2, MAE, RMSE
MAPE is intentionally not included.
"""

from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error


# ============================================================
# 1. SETTINGS
# ============================================================

# Change this to your Excel dataset.
DATA_FILE = Path("DATABASE PLATFORM.xlsx")

# Your existing model folder.
MODELS_DIR = Path("models")

# Excel output containing metrics + row-level predictions.
OUTPUT_FILE = Path("existing_model_accuracy_results.xlsx")

# Optional independent test dataset.
# If you have a genuinely unseen test dataset, put its path here.
# Otherwise leave as None to evaluate the existing models on DATA_FILE.
TEST_FILE = None
# Example:
# TEST_FILE = Path("independent_test_data.xlsx")


# ============================================================
# 2. MODEL / COLUMN CONFIGURATION
# ============================================================

# Input columns in the current RAW Excel file.
INPUT_COLUMNS = [
    "Leg",
    "Water Depth (meter)",
    "Panjang (km)",
    "Diameter (inch)",
    "Piles",
    "Jacket",
    "Topsides/Deck",
    "Conductor",
]

# Existing model artifacts and their target columns.
MODELS = {
    "substructure": {
        "file": "substructure.pkl",
        "target": "Subtotal",
        "features": [
            "Water Depth (meter)",
            "Piles",
            "Jacket",
            "Conductor",
        ],
    },

    "pipeline": {
        "file": "pipeline.pkl",
        "target": "Pipe Sub-Total",
        "features": [
            "Panjang (km)",
            "Diameter (inch)",
            "Water Depth (meter)",
        ],
    },

    "topside_deck": {
        "file": "topside_deck.pkl",
        "target": "deck Sub-Total",
        "features": [
            "Topsides/Deck",
            "Water Depth (meter)",
        ],
    },

    "topside_production": {
        "file": "topside_production.pkl",
        "target": "Production Sub-Total",
        "features": [
            "Topsides/Deck",
            "Water Depth (meter)",
        ],
    },

    "certification": {
        "file": "certification.pkl",
        "target": "Certification and Permit",
        "features": INPUT_COLUMNS,
    },

    "general_support": {
        "file": "general_support.pkl",
        "target": "Sub Total General Support",
        "features": INPUT_COLUMNS,
    },
}


# ============================================================
# 3. HELPERS
# ============================================================

def clean_columns(df):
    """
    Normalize Excel headers without changing the underlying Excel file.
    This removes line breaks and surrounding spaces.
    """
    df = df.copy()

    df.columns = (
        df.columns.astype(str)
        .str.replace("\n", " ", regex=False)
        .str.strip()
    )

    return df


def clean_numeric_columns(df, columns):
    """
    Convert model variables and targets to numeric values.
    Non-numeric strings become NaN.
    """
    df = df.copy()

    for col in columns:
        if col in df.columns:
            # Handles strings such as "1,234.56" and numeric Excel cells.
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(",", "", regex=False)
                .str.strip()
                .replace({
                    "": np.nan,
                    "nan": np.nan,
                    "None": np.nan,
                    "NaN": np.nan,
                })
            )

            df[col] = pd.to_numeric(df[col], errors="coerce")

    return df


def load_raw_data(path):
    """
    RAW sheet uses the second Excel row as the header.
    """
    print(f"\nLoading data from: {path}")

    df = pd.read_excel(
        path,
        sheet_name="RAW",
        header=1
    )

    df = clean_columns(df)

    return df


def calculate_metrics(y_true, y_pred):
    """
    Calculate the three metrics used in the thesis.
    """
    return {
        "R2": r2_score(y_true, y_pred),
        "MAE": mean_absolute_error(y_true, y_pred),
        "RMSE": np.sqrt(mean_squared_error(y_true, y_pred)),
    }


# ============================================================
# 4. LOAD DATA
# ============================================================

if TEST_FILE is not None:
    evaluation_file = Path(TEST_FILE)
    evaluation_label = "Independent test dataset"
else:
    evaluation_file = DATA_FILE
    evaluation_label = "Original RAW dataset"

if not evaluation_file.exists():
    raise FileNotFoundError(
        f"Dataset not found:\n{evaluation_file}\n\n"
        "Update DATA_FILE or TEST_FILE at the top of this script."
    )

df = load_raw_data(evaluation_file)

print(f"Rows loaded: {len(df)}")
print(f"Columns loaded: {len(df.columns)}")


# ============================================================
# 5. CHECK REQUIRED COLUMNS
# ============================================================

required_columns = set(INPUT_COLUMNS)

for config in MODELS.values():
    required_columns.update(config["features"])
    required_columns.add(config["target"])

missing = sorted(
    col for col in required_columns
    if col not in df.columns
)

if missing:
    print("\nERROR: The following columns were not found:")
    for col in missing:
        print("  -", col)

    print("\nAvailable columns:")
    for i, col in enumerate(df.columns):
        print(f"  {i:03d}: {col}")

    raise ValueError("Required columns are missing from the dataset.")


# Convert all model features + targets to numeric.
numeric_columns = set()

for config in MODELS.values():
    numeric_columns.update(config["features"])
    numeric_columns.add(config["target"])

df = clean_numeric_columns(df, numeric_columns)


# ============================================================
# 6. EVALUATE EACH EXISTING MODEL
# ============================================================

summary_rows = []
prediction_tables = {}

print("\n" + "=" * 75)
print("EXISTING MODEL EVALUATION")
print("=" * 75)

for model_name, config in MODELS.items():

    model_path = MODELS_DIR / config["file"]

    if not model_path.exists():
        print(f"\nWARNING: Model not found: {model_path}")
        continue

    print(f"\n[{model_name.upper()}]")
    print(f"Model: {model_path}")

    # Load existing model artifact.
    model = joblib.load(model_path)

    features = config["features"]
    target = config["target"]

    # Only rows with a known target can be scored.
    valid = df[features + [target]].dropna(subset=[target]).copy()

    # XGBoost can handle NaN feature values, so do not automatically
    # delete rows merely because an input feature is missing.
    X = valid[features]
    y_true = valid[target].astype(float)

    # Predict using the EXISTING trained model.
    y_pred = np.asarray(model.predict(X), dtype=float)

    # Guard against accidental invalid predictions.
    y_pred = np.nan_to_num(
        y_pred,
        nan=0.0,
        posinf=0.0,
        neginf=0.0
    )

    metrics = calculate_metrics(y_true, y_pred)

    print(f"Rows evaluated : {len(valid)}")
    print(f"R²             : {metrics['R2']:.6f}")
    print(f"MAE            : ${metrics['MAE']:,.2f}")
    print(f"RMSE           : ${metrics['RMSE']:,.2f}")

    summary_rows.append({
        "Model": model_name,
        "Rows Evaluated": len(valid),
        "R2": metrics["R2"],
        "MAE (USD)": metrics["MAE"],
        "RMSE (USD)": metrics["RMSE"],
        "Evaluation Dataset": evaluation_label,
    })

    # Keep row-level results so you can inspect individual predictions.
    result = valid[[target]].copy()
    result = result.rename(columns={target: "Actual Cost (USD)"})

    result["Predicted Cost (USD)"] = y_pred
    result["Absolute Error (USD)"] = np.abs(
        result["Actual Cost (USD)"] -
        result["Predicted Cost (USD)"]
    )

    result["Error (%)"] = np.where(
        result["Actual Cost (USD)"] != 0,
        (
            result["Absolute Error (USD)"] /
            np.abs(result["Actual Cost (USD)"])
        ) * 100,
        np.nan
    )

    prediction_tables[model_name] = result.reset_index(drop=True)


# ============================================================
# 7. CREATE SUMMARY TABLE
# ============================================================

summary = pd.DataFrame(summary_rows)

if summary.empty:
    raise RuntimeError(
        "No models were evaluated. Check MODELS_DIR and model filenames."
    )

print("\n" + "=" * 75)
print("SUMMARY")
print("=" * 75)

print(
    summary[
        [
            "Model",
            "Rows Evaluated",
            "R2",
            "MAE (USD)",
            "RMSE (USD)",
        ]
    ].to_string(index=False)
)


# ============================================================
# 8. SAVE EXCEL RESULTS
# ============================================================

with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:

    summary.to_excel(
        writer,
        sheet_name="Summary",
        index=False
    )

    for model_name, table in prediction_tables.items():

        # Excel sheet names have a 31-character limit.
        sheet_name = model_name[:31]

        table.to_excel(
            writer,
            sheet_name=sheet_name,
            index=False
        )

print("\nResults saved to:")
print(OUTPUT_FILE.resolve())


# ============================================================
# 9. INTERPRETATION WARNING
# ============================================================

print("\n" + "=" * 75)
print("IMPORTANT INTERPRETATION")
print("=" * 75)

if TEST_FILE is None:
    print(
        """
You evaluated the existing models against the original RAW dataset.

If these models were trained using these same projects, including synthetic
data generated from these projects, these scores should NOT be presented as
independent test accuracy.

They are useful as an apparent/in-sample performance check.

For an unbiased final evaluation, provide an independent test dataset
containing projects that were not used to train the models and were not
used to generate the synthetic data.
"""
    )
else:
    print(
        """
The models were evaluated against the independent TEST_FILE.

If this dataset was completely excluded from model training and synthetic
data generation, the resulting R2, MAE, and RMSE can be reported as
independent test-set performance.
"""
    )

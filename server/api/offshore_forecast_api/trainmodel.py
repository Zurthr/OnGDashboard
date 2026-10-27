# ============================================================
# OFFSHORE PLATFORM PROJECT COST FORECASTING
#
# Gaussian Copula + XGBoost + LOOCV
#
# DATA SOURCE:
# Excel workbook
# Sheet: RAW
# Header: Row 2
#
# ============================================================

import os
import re
import json
import warnings

import joblib
import numpy as np
import pandas as pd

from scipy.stats import norm

from sklearn.model_selection import LeaveOneOut
from sklearn.metrics import (
    r2_score,
    mean_absolute_error,
    mean_squared_error
)

from xgboost import XGBRegressor
warnings.filterwarnings("ignore")

# ============================================================
# SETTINGS
# ============================================================

INPUT_FILE = "DATABASE PLATFORM (Plus 25 Questor).xlsx"

SHEET_NAME = "RAW"

HEADER_ROW = 1
# Excel row 2 = pandas header=1

SYNTHETIC_RATIO = 5
#change this according to the best ratio you want to use for synthetic data generation

RANDOM_STATE = 42

MODEL_FOLDER = "models"

os.makedirs(
    MODEL_FOLDER,
    exist_ok=True
)

# ============================================================
# COLUMN DEFINITIONS
# ============================================================
#
# IMPORTANT:
# These are the column names expected in RAW row 2.
#
# If your Excel has slightly different spelling, change them
# here only.
# ============================================================

# ------------------------------------------------------------
# INPUT VARIABLES
# ------------------------------------------------------------

INPUT_COLUMNS = {

    "leg":
        "Leg",

    "water_depth":
        "Water Depth (meter)",

    "pipe_length":
        "Panjang (km)",

    "pipe_diameter":
        "Diameter (inch)",

    "piles":
        "Piles",

    "jacket":
        "Jacket",

    "topside":
        "Topsides/Deck",

    "conductor":
        "Conductor"
}

# ------------------------------------------------------------
# COST OUTPUTS
# ------------------------------------------------------------

TARGET_COLUMNS = {

    "substructure":
        "Subtotal",

    "pipeline":
        "Pipe Sub-Total",

    "topside_deck":
        "deck Sub-Total",

    "topside_production":
        "Production Sub-Total",

    "certification":
        "Certification and Permit",

    "general_support":
        "Sub Total General Support"
}

# ============================================================
# MODEL FEATURE RELATIONSHIPS
# ============================================================

MODEL_FEATURES = {

    # --------------------------------------------------------
    # Substructure
    # --------------------------------------------------------
    "substructure": [
        INPUT_COLUMNS["water_depth"],
        INPUT_COLUMNS["piles"],
        INPUT_COLUMNS["jacket"],
        INPUT_COLUMNS["conductor"]
    ],

    # --------------------------------------------------------
    # Pipeline
    # --------------------------------------------------------
    "pipeline": [
        INPUT_COLUMNS["pipe_length"],
        INPUT_COLUMNS["pipe_diameter"],
        INPUT_COLUMNS["water_depth"]
    ],

    # --------------------------------------------------------
    # Topside Deck Structure
    # --------------------------------------------------------
    "topside_deck": [
        INPUT_COLUMNS["topside"],
        INPUT_COLUMNS["water_depth"]
    ],

    # --------------------------------------------------------
    # Topside Production
    # --------------------------------------------------------
    "topside_production": [
        INPUT_COLUMNS["topside"],
        INPUT_COLUMNS["water_depth"]
    ],

    # --------------------------------------------------------
    # Certification and Permit
    # --------------------------------------------------------
    "certification": [
        INPUT_COLUMNS["leg"],
        INPUT_COLUMNS["water_depth"],
        INPUT_COLUMNS["pipe_length"],
        INPUT_COLUMNS["pipe_diameter"],
        INPUT_COLUMNS["piles"],
        INPUT_COLUMNS["jacket"],
        INPUT_COLUMNS["topside"],
        INPUT_COLUMNS["conductor"]
    ],

    # --------------------------------------------------------
    # General Support
    # --------------------------------------------------------
    "general_support": [
        INPUT_COLUMNS["leg"],
        INPUT_COLUMNS["water_depth"],
        INPUT_COLUMNS["pipe_length"],
        INPUT_COLUMNS["pipe_diameter"],
        INPUT_COLUMNS["piles"],
        INPUT_COLUMNS["jacket"],
        INPUT_COLUMNS["topside"],
        INPUT_COLUMNS["conductor"]
    ]
}

# ============================================================
# NUMERIC CLEANING
# ============================================================

def clean_numeric(value):

    """
    Converts mixed Excel values into numeric values.
    Handles examples such as:

        12345
        12345.5
        12,345.5
        12.345,5
        $12,345.50
        12,5 km
        10 inch
    """

    if pd.isna(value):
        return np.nan

    if isinstance(
        value,
        (
            int,
            float,
            np.integer,
            np.floating
        )
    ):

        return float(value)

    value = str(value).strip()

    if value == "":
        return np.nan

    # Remove currency/unit text
    value = value.replace(
        "$",
        ""
    )

    value = value.replace(
        "USD",
        ""
    )

    value = value.replace(
        "usd",
        ""
    )

    value = value.replace(
        "MT",
        ""
    )

    value = value.replace(
        "km",
        ""
    )

    value = value.replace(
        "KM",
        ""
    )

    value = value.replace(
        "inch",
        ""
    )

    value = value.replace(
        "INCH",
        ""
    )

    value = value.strip()

    # --------------------------------------------------------
    # Decimal separator handling
    # --------------------------------------------------------

    if "," in value and "." in value:

        # Example:
        # 1.234,56

        if value.rfind(",") > value.rfind("."):

            value = value.replace(
                ".",
                ""
            )

            value = value.replace(
                ",",
                "."
            )

        # Example:
        # 1,234.56

        else:

            value = value.replace(
                ",",
                ""
            )

    elif "," in value:

        # Example:
        # 1234,56

        value = value.replace(
            ",",
            "."
        )

    # --------------------------------------------------------
    # Extract numeric portion
    # --------------------------------------------------------

    match = re.search(
        r"-?\d+(?:\.\d+)?",
        value
    )

    if match:
        try:
            return float(
                match.group()
            )

        except:
            return np.nan

    return np.nan

# ============================================================
# PIPE LENGTH CLEANING
# ============================================================

def clean_pipe_length(value):

    """
    Handles values such as:

        67.2
        67,2 km
        67,2 km; 3,5 km; 12,1 km

    When multiple lengths exist, the largest numeric value
    is used.
    """

    if pd.isna(value):
        return np.nan

    # Already numeric
    if isinstance(
        value,
        (
            int,
            float,
            np.integer,
            np.floating
        )
    ):
        return float(value)

    text = str(value)
    numbers = re.findall(
        r"\d+(?:[.,]\d+)?",
        text
    )

    if len(numbers) == 0:
        return np.nan

    values = []

    for number in numbers:
        try:
            values.append(
                float(
                    number.replace(
                        ",",
                        "."
                    )
                )
            )

        except:
            pass

    if len(values) == 0:
        return np.nan

    return max(values)

# ============================================================
# LOAD RAW DATA
# ============================================================

print("\n")
print("=" * 70)
print("OFFSHORE PLATFORM COST FORECASTING")
print("=" * 70)

print("\nLoading RAW sheet...")

df = pd.read_excel(
    INPUT_FILE,
    sheet_name=SHEET_NAME,
    header=HEADER_ROW
)

# Clean line breaks and spaces in Excel headers
df.columns = (
    df.columns
    .astype(str)
    .str.replace("\n", " ", regex=False)
    .str.strip()
)

print(
    f"Rows loaded: {len(df)}"
)

print(
    f"Columns loaded: {len(df.columns)}"
)

# ============================================================
# DISPLAY COLUMNS
# ============================================================

print("\n")
print("=" * 70)
print("RAW COLUMNS")
print("=" * 70)

for i, column in enumerate(
    df.columns
):

    print(
        f"{i:03d}: {column}"
    )

# ============================================================
# VERIFY REQUIRED COLUMNS
# ============================================================

required_columns = (
    list(
        INPUT_COLUMNS.values()
    )
    +
    list(
        TARGET_COLUMNS.values()
    )
)

missing_columns = [
    column
    for column in required_columns
    if column not in df.columns
]

if missing_columns:

    print("\n")
    print("=" * 70)
    print("MISSING COLUMNS")
    print("=" * 70)

    for column in missing_columns:

        print(
            f"- {column}"
        )

    raise ValueError(
        "\nSome required columns were not found. "
        "Check the RAW row-2 headers."
    )

# ============================================================
# CLEAN INPUT VARIABLES
# ============================================================

print("\nCleaning input variables...")

for column in INPUT_COLUMNS.values():
    # Pipe length requires special treatment
    if column == INPUT_COLUMNS["pipe_length"]:

        df[column] = (
            df[column]
            .apply(
                clean_pipe_length
            )
        )
    else:

        df[column] = (
            df[column]
            .apply(
                clean_numeric
            )
        )

# ============================================================
# CLEAN TARGET VARIABLES
# ============================================================

print(
    "Cleaning cost target variables..."
)

for column in TARGET_COLUMNS.values():

    df[column] = (
        df[column]
        .apply(
            clean_numeric
        )
    )

# ============================================================
# ENGINEERING CONSTRAINTS
# ============================================================

# These constraints prevent synthetic data from generating
# physically impossible negative engineering quantities.

NON_NEGATIVE_COLUMNS = (
    list(
        INPUT_COLUMNS.values()
    )
)

for column in NON_NEGATIVE_COLUMNS:

    df[column] = (
        df[column]
        .clip(
            lower=0
        )
    )

# Cost cannot be negative

for column in TARGET_COLUMNS.values():

    df[column] = (
        df[column]
        .clip(
            lower=0
        )
    )

# ============================================================
# DISPLAY DATA QUALITY
# ============================================================

print("\n")
print("=" * 70)
print("MISSING VALUES AFTER CLEANING")
print("=" * 70)

check_columns = (
    list(
        INPUT_COLUMNS.values()
    )
    +
    list(
        TARGET_COLUMNS.values()
    )
)

missing_table = (
    df[check_columns]
    .isna()
    .sum()
)

print(
    missing_table
)

# ============================================================
# REMOVE COMPLETELY EMPTY RECORDS
# ============================================================

df = df.dropna(
    how="all",
    subset=check_columns
)

print(
    f"\nUsable rows: {len(df)}"
)

# ============================================================
# COMPONENT-SPECIFIC MODEL DATASETS
# ============================================================
#
# Missing values are handled separately for each cost component.
#
# Example:
#   If Pipeline inputs are missing for one project, that project
#   is excluded from the Pipeline model only.
#
#   The same project can still be used by Topside, Substructure,
#   or another model when all variables required by that model
#   are available.
#
# This prevents missing values in one cost section from removing
# otherwise usable information from other cost sections.
# ============================================================

def prepare_model_dataset(
    model_name,
    dataframe
):

    features = MODEL_FEATURES[
        model_name
    ]

    target = TARGET_COLUMNS[
        model_name
    ]

    required_columns = (
        features
        +
        [target]
    )

    model_data = dataframe[
        required_columns
    ].copy()

    # --------------------------------------------------------
    # Only remove rows that are incomplete for THIS model.
    # --------------------------------------------------------

    missing_before = (
        model_data
        .isna()
        .any(axis=1)
    )

    excluded_rows = int(
        missing_before.sum()
    )

    model_data = model_data.dropna(
        subset=required_columns
    ).reset_index(
        drop=True
    )

    print(
        f"  {model_name:<20} "
        f"usable: {len(model_data):>4} | "
        f"excluded: {excluded_rows:>4}"
    )

    if excluded_rows > 0:
        print(
            f"    Required columns: "
            f"{', '.join(required_columns)}"
        )

    return model_data


# ============================================================
# PREPARE DATASET FOR EACH MODEL
# ============================================================

print("\n")
print("=" * 70)
print("COMPONENT-SPECIFIC DATA AVAILABILITY")
print("=" * 70)
print(
    "Rows are excluded only when a required feature or target "
    "for that specific model is missing."
)

model_datasets = {}

for model_name in MODEL_FEATURES:

    model_datasets[
        model_name
    ] = prepare_model_dataset(
        model_name,
        df
    )


# ============================================================
# GAUSSIAN COPULA GENERATOR
# ============================================================

def gaussian_copula_generate(
    data,
    number_of_rows,
    random_state=42
):

    """
    Generates synthetic tabular data using a Gaussian Copula.

    The generator receives ONLY complete observations belonging
    to one cost component. Therefore, each model gets its own
    Gaussian Copula based on the variables relevant to that model.

    Procedure:

        1. Rank each variable
        2. Convert ranks to uniform distribution
        3. Convert uniform values to Gaussian values
        4. Estimate correlation matrix
        5. Sample correlated Gaussian observations
        6. Transform back through empirical quantiles
    """

    if number_of_rows <= 0:

        return pd.DataFrame(
            columns=data.columns
        )

    if len(data) < 2:

        raise ValueError(
            "Gaussian Copula requires at least 2 complete "
            "observations."
        )

    # The model-specific dataset should already be complete.
    if data.isna().any().any():

        missing_columns = list(
            data.columns[
                data.isna().any()
            ]
        )

        raise ValueError(
            "Unexpected missing values found in Gaussian Copula "
            f"data: {missing_columns}"
        )

    rng = np.random.default_rng(
        random_state
    )

    columns = list(
        data.columns
    )

    n = len(data)

    # --------------------------------------------------------
    # Rank -> Uniform
    # --------------------------------------------------------

    uniform_data = pd.DataFrame(
        index=data.index
    )

    for column in columns:

        values = pd.to_numeric(
            data[column],
            errors="coerce"
        )

        if values.isna().any():
            raise ValueError(
                f"Unexpected missing values found in "
                f"column '{column}' for Gaussian Copula."
            )

        ranks = (
            values
            .rank(
                method="average"
            )
        )

        uniform = (
            ranks
            -
            0.5
        ) / n

        uniform_data[
            column
        ] = uniform

    # --------------------------------------------------------
    # Uniform -> Gaussian
    # --------------------------------------------------------

    gaussian_data = pd.DataFrame(
        index=data.index
    )

    for column in columns:

        u = uniform_data[
            column
        ].values

        # Avoid infinity
        u = np.clip(
            u,
            0.0001,
            0.9999
        )

        gaussian_data[
            column
        ] = norm.ppf(
            u
        )

    # --------------------------------------------------------
    # Correlation matrix
    # --------------------------------------------------------

    correlation_matrix = (
        gaussian_data
        .corr()
        .values
    )

    # --------------------------------------------------------
    # Numerical stability
    # --------------------------------------------------------

    eigenvalues, eigenvectors = (
        np.linalg.eigh(
            correlation_matrix
        )
    )

    eigenvalues = np.maximum(
        eigenvalues,
        1e-6
    )

    correlation_matrix = (
        eigenvectors
        @
        np.diag(
            eigenvalues
        )
        @
        eigenvectors.T
    )

    # Normalize diagonal

    diagonal = np.sqrt(
        np.diag(
            correlation_matrix
        )
    )

    correlation_matrix = (
        correlation_matrix
        /
        np.outer(
            diagonal,
            diagonal
        )
    )

    # --------------------------------------------------------
    # Generate Gaussian observations
    # --------------------------------------------------------

    synthetic_gaussian = (
        rng.multivariate_normal(

            mean=np.zeros(
                len(columns)
            ),

            cov=correlation_matrix,
            size=number_of_rows
        )
    )

    # --------------------------------------------------------
    # Gaussian -> Uniform
    # --------------------------------------------------------

    synthetic_uniform = (
        norm.cdf(
            synthetic_gaussian
        )
    )

    # --------------------------------------------------------
    # Uniform -> empirical distribution
    # --------------------------------------------------------

    synthetic = pd.DataFrame(
        index=range(
            number_of_rows
        )
    )

    for i, column in enumerate(
        columns
    ):

        original_values = (
            pd.to_numeric(
                data[column],
                errors="coerce"
            )
            .sort_values()
            .values
        )

        if len(
            original_values
        ) == 0:

            synthetic[column] = np.nan
            continue

        positions = (
            synthetic_uniform[
                :, i
            ]
            *
            (
                len(
                    original_values
                )
                - 1
            )
        )

        lower = np.floor(
            positions
        ).astype(int)

        upper = np.ceil(
            positions
        ).astype(int)

        fraction = (
            positions
            -
            lower
        )

        synthetic[column] = (
            original_values[
                lower
            ]
            *
            (
                1
                -
                fraction
            )
            +
            original_values[
                upper
            ]
            *
            fraction
        )

    return synthetic


# ============================================================
# ENGINEERING CONSTRAINTS FOR SYNTHETIC DATA
# ============================================================

def apply_synthetic_constraints(
    synthetic,
    original
):

    """
    Applies engineering constraints only to columns that exist
    in the current component-specific dataset.

    This is important because different cost models use different
    feature sets. For example, the Substructure dataset does not
    contain pipe length, so pipe-length constraints must not be
    applied to that dataset.
    """

    synthetic = synthetic.copy()

    # --------------------------------------------------------
    # Leg
    # --------------------------------------------------------

    leg = INPUT_COLUMNS[
        "leg"
    ]

    if leg in synthetic.columns:

        synthetic[leg] = (
            synthetic[leg]
            .clip(
                original[leg].min(),
                original[leg].max()
            )
            .round()
        )

    # --------------------------------------------------------
    # Water depth
    # --------------------------------------------------------

    water_depth = INPUT_COLUMNS[
        "water_depth"
    ]

    if water_depth in synthetic.columns:

        synthetic[water_depth] = (
            synthetic[water_depth]
            .clip(
                original[water_depth].min(),
                original[water_depth].max()
            )
        )

    # --------------------------------------------------------
    # Pipe length
    # --------------------------------------------------------

    pipe_length = INPUT_COLUMNS[
        "pipe_length"
    ]

    if pipe_length in synthetic.columns:

        synthetic[pipe_length] = (
            synthetic[pipe_length]
            .clip(
                lower=0
            )
        )

    # --------------------------------------------------------
    # Pipe diameter
    # --------------------------------------------------------

    pipe_diameter = INPUT_COLUMNS[
        "pipe_diameter"
    ]

    if pipe_diameter in synthetic.columns:

        synthetic[pipe_diameter] = (
            synthetic[pipe_diameter]
            .clip(
                lower=0
            )
        )

    # --------------------------------------------------------
    # Structural weights
    # --------------------------------------------------------

    for key in [
        "piles",
        "jacket",
        "topside",
        "conductor"
    ]:

        column = INPUT_COLUMNS[
            key
        ]

        if column in synthetic.columns:

            synthetic[column] = (
                synthetic[column]
                .clip(
                    lower=0
                )
            )

    # --------------------------------------------------------
    # Costs
    # --------------------------------------------------------

    for column in TARGET_COLUMNS.values():

        if column in synthetic.columns:

            synthetic[column] = (
                synthetic[column]
                .clip(
                    lower=0
                )
            )

    return synthetic


# ============================================================
# CREATE COMPONENT-SPECIFIC SYNTHETIC DATA
# ============================================================

print("\n")
print("=" * 70)
print("GAUSSIAN COPULA SYNTHESIS BY COMPONENT")
print("=" * 70)

synthetic_datasets = {}
combined_datasets = {}

for model_name in MODEL_FEATURES:

    model_data = model_datasets[
        model_name
    ]

    synthetic_count = int(
        len(model_data)
        *
        SYNTHETIC_RATIO
    )

    print("\n" + "-" * 70)
    print(
        f"Model: {model_name}"
    )
    print(
        f"Original observations : {len(model_data)}"
    )
    print(
        f"Synthetic ratio       : {SYNTHETIC_RATIO}x"
    )
    print(
        f"Synthetic observations: {synthetic_count}"
    )

    if len(model_data) < 2:

        print(
            "WARNING: Not enough complete observations for "
            "Gaussian Copula synthesis."
        )
        print(
            f"Skipping {model_name} synthetic-data generation."
        )

        synthetic_datasets[
            model_name
        ] = pd.DataFrame(
            columns=model_data.columns
        )

    else:

        synthetic_data = (
            gaussian_copula_generate(
                model_data,
                synthetic_count,
                RANDOM_STATE
            )
        )

        synthetic_data = (
            apply_synthetic_constraints(
                synthetic_data,
                model_data
            )
        )

        synthetic_datasets[
            model_name
        ] = synthetic_data

    # --------------------------------------------------------
    # Combine original + synthetic data for THIS model only.
    # --------------------------------------------------------

    original_training = model_data.copy()

    original_training[
        "Data_Type"
    ] = "Original"

    synthetic_training = (
        synthetic_datasets[
            model_name
        ].copy()
    )

    synthetic_training[
        "Data_Type"
    ] = "Synthetic"

    combined_datasets[
        model_name
    ] = pd.concat(
        [
            original_training,
            synthetic_training
        ],
        ignore_index=True
    )

    print(
        f"Combined observations  : "
        f"{len(combined_datasets[model_name])}"
    )


# ============================================================
# SAVE SYNTHETIC DATA
# ============================================================
#
# All component-specific synthetic datasets are saved into one
# workbook. Each component receives its own worksheet because
# the feature columns differ between models.
# ============================================================

synthetic_file = (
    f"synthetic_data_"
    f"{SYNTHETIC_RATIO}x.xlsx"
)

with pd.ExcelWriter(
    synthetic_file,
    engine="openpyxl"
) as writer:

    for model_name in MODEL_FEATURES:

        synthetic_datasets[
            model_name
        ].to_excel(
            writer,
            sheet_name=model_name[:31],
            index=False
        )

print(
    f"\nSynthetic data saved to:"
    f" {synthetic_file}"
)

# ============================================================
# XGBOOST MODEL
# ============================================================

def create_model(features):

    # Constrain every feature to have a nondecreasing
    # relationship with its predicted cost.
    #
    #  1 = Increasing or constant
    #  0 = Unconstrained
    # -1 = Decreasing or constant

    monotonic_constraints = tuple(
        1 for _ in features
    )

    return XGBRegressor(
        objective="reg:squarederror",
        n_estimators=300,
        learning_rate=0.05,
        max_depth=5,
        min_child_weight=3,
        subsample=0.8,
        colsample_bytree=0.8,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        random_state=RANDOM_STATE,

        # Apply the constraints
        monotone_constraints=monotonic_constraints
    )

# ============================================================
# LOOCV
# ============================================================

def evaluate_model(
    model_name,
    dataset
):

    features = MODEL_FEATURES[
        model_name
    ]

    target = TARGET_COLUMNS[
        model_name
    ]

    data = dataset[
        features
        +
        [target]
    ].copy()

    # --------------------------------------------------------
    # Remove rows missing ANY required feature or target.
    # This is component-specific.
    # --------------------------------------------------------

    data = data.dropna(
        subset=features + [target]
    )

    X = data[
        features
    ]

    y = data[
        target
    ]

    if len(data) < 2:
        return {
            "R2": np.nan,
            "MAE": np.nan,
            "RMSE": np.nan,
            "Observations":
                len(data)
        }

    loo = LeaveOneOut()

    actuals = []
    predictions = []

    print("\n")
    print(
        f"LOOCV: {model_name}"
    )

    # --------------------------------------------------------
    # Leave-One-Out
    # --------------------------------------------------------

    for train_index, test_index in loo.split(X):

        X_train = X.iloc[
            train_index
        ]

        X_test = X.iloc[
            test_index
        ]

        y_train = y.iloc[
            train_index
        ]

        y_test = y.iloc[
            test_index
        ]

        model = create_model(features)

        model.fit(
            X_train,
            y_train
        )

        prediction = model.predict(
            X_test
        )[0]

        actuals.append(
            y_test.iloc[0]
        )

        predictions.append(
            prediction
        )

    actuals = np.array(
        actuals
    )

    predictions = np.array(
        predictions
    )

    # --------------------------------------------------------
    # Metrics
    # --------------------------------------------------------

    r2 = r2_score(
        actuals,
        predictions
    )

    mae = mean_absolute_error(
        actuals,
        predictions
    )

    rmse = np.sqrt(
        mean_squared_error(
            actuals,
            predictions
        )
    )

    return {
        "R2": r2,
        "MAE": mae,
        "RMSE": rmse,
        "Observations":
            len(data)
    }


# ============================================================
# FINAL MODEL TRAINING
# ============================================================

def train_final_model(
    model_name,
    dataset
):

    features = MODEL_FEATURES[
        model_name
    ]

    target = TARGET_COLUMNS[
        model_name
    ]

    data = dataset[
        features
        +
        [target]
    ].copy()

    # --------------------------------------------------------
    # Remove rows missing ANY required feature or target.
    # This is component-specific.
    # --------------------------------------------------------

    data = data.dropna(
        subset=features + [target]
    )

    X = data[
        features
    ]

    y = data[
        target
    ]

    model = create_model(features)

    model.fit(
        X,
        y
    )

    filename = os.path.join(
        MODEL_FOLDER,
        f"{model_name}.pkl"
    )

    joblib.dump(
        model,
        filename
    )

    print(
        f"Saved: {filename}"
    )

    # --------------------------------------------------------
    # Feature importance
    # --------------------------------------------------------

    importance = (
        model.feature_importances_
    )

    importance_df = pd.DataFrame({
        "Feature":
            features,
        "Importance":
            importance
    })

    importance_df[
        "Importance (%)"
    ] = (
        importance_df[
            "Importance"
        ]
        /
        importance_df[
            "Importance"
        ].sum()
        *
        100
    )

    importance_df = (
        importance_df
        .sort_values(
            "Importance (%)",
            ascending=False
        )
    )

    importance_df.to_excel(

        os.path.join(
            MODEL_FOLDER,
            f"{model_name}_feature_importance.xlsx"
        ),
        index=False
    )

    return model

# ============================================================
# EVALUATE ALL MODELS
# ============================================================

print("\n")
print("=" * 70)
print("MODEL EVALUATION")
print("=" * 70)

metrics = []

for model_name in MODEL_FEATURES:

    result = evaluate_model(
        model_name,
        combined_datasets[model_name]
    )

    result[
        "Model"
    ] = model_name

    result[
        "Target"
    ] = TARGET_COLUMNS[
        model_name
    ]

    result[
        "Synthetic_Ratio"
    ] = SYNTHETIC_RATIO

    metrics.append(
        result
    )


# ============================================================
# TRAIN FINAL MODELS
# ============================================================

print("\n")
print("=" * 70)
print("FINAL MODEL TRAINING")
print("=" * 70)

for model_name in MODEL_FEATURES:
    train_final_model(
        model_name,
        combined_datasets[model_name]
    )

# ============================================================
# METRICS TABLE
# ============================================================

metrics_df = pd.DataFrame(
    metrics
)

metrics_df = metrics_df[

    [
        "Model",
        "Target",
        "Synthetic_Ratio",
        "Observations",
        "R2",
        "MAE",
        "RMSE"
    ]

]

print("\n")
print("=" * 70)
print("MODEL ACCURACY")
print("=" * 70)

print(
    metrics_df.to_string(
        index=False
    )
)


# ============================================================
# SAVE METRICS
# ============================================================

metrics_file = (
    f"model_metrics_"
    f"{SYNTHETIC_RATIO}x.xlsx"
)


metrics_df.to_excel(
    metrics_file,
    index=False
)


print(
    f"\nMetrics saved to:"
    f" {metrics_file}"
)


# ============================================================
# SAVE MODEL CONFIGURATION
# ============================================================

configuration = {

    "input_file":
        INPUT_FILE,

    "sheet":
        SHEET_NAME,

    "header_row":
        2,

    "synthetic_ratio":
        SYNTHETIC_RATIO,

    "input_variables":
        INPUT_COLUMNS,

    "target_variables":
        TARGET_COLUMNS,

    "model_features":
        MODEL_FEATURES,

    "model":
        "XGBoost",

    "validation":
        "Leave-One-Out Cross-Validation",

    "metrics":
        [
            "R2",
            "MAE",
            "RMSE"
        ]
}

with open(
    os.path.join(
        MODEL_FOLDER,
        "model_config.json"
    ),
    "w"
) as file:
    json.dump(
        configuration,
        file,
        indent=4
    )


# ============================================================
# COMPLETE
# ============================================================

print("\n")
print("=" * 70)
print("TRAINING COMPLETE")
print("=" * 70)

print("\nFiles generated:")
print(
    f"- {synthetic_file}"
)
print(
    f"- {metrics_file}"
)
print(
    "- models/substructure.pkl"
)
print(
    "- models/pipeline.pkl"
)
print(
    "- models/topside_deck.pkl"
)
print(
    "- models/topside_production.pkl"
)
print(
    "- models/certification.pkl"
)
print(
    "- models/general_support.pkl"
)
print(
    "- models/*_feature_importance.xlsx"
)
print(
    "- models/model_config.json"
)
print("\n")
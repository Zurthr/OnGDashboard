import os
import re
import warnings
import numpy as np
import pandas as pd
from scipy.stats import norm, rankdata
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor
from joblib import Parallel, delayed

warnings.filterwarnings('ignore')

# ============================================================
# CONFIGURATION — aligned with newest model artifacts
# ============================================================
FILE_PATH = r'C:\Users\dzaki\Downloads\offshore_forecast_api\DATABASE PLATFORM.xlsx'  # Insert Path of DATABASE PLATFORM.xlsx here
SHEET_NAME = 'RAW'  # Insert Sheet Name here
HEADER_ROW = 1                 # Header in Excel row 2 (intended row + 1)
RATIOS = [0, 1, 2, 3, 5, 10, 15, 20]  # Synthetic data ratios to test
RANDOM_STATE = 42

# Newest model hyperparameters
XGB_PARAMS = dict(
    objective='reg:squarederror',
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
    n_jobs=1,
    tree_method='hist',
)

FEATURES = {
    'substructure': ['Water Depth (meter)', 'Piles', 'Jacket', 'Conductor'],
    'pipeline': ['Panjang (km)', 'Diameter (inch)', 'Water Depth (meter)'],
    'topside_deck': ['Topsides/Deck', 'Water Depth (meter)'],
    'topside_production': ['Topsides/Deck', 'Water Depth (meter)'],
    'certification': ['Leg', 'Water Depth (meter)', 'Panjang (km)', 'Diameter (inch)', 'Piles', 'Jacket', 'Topsides/Deck', 'Conductor'],
    'general_support': ['Leg', 'Water Depth (meter)', 'Panjang (km)', 'Diameter (inch)', 'Piles', 'Jacket', 'Topsides/Deck', 'Conductor'],
}

# These are the actual positions in the RAW sheet's two-row grouped header.
# Position mapping avoids ambiguity from pandas' duplicate-column suffixes. Will have to change if format changes.
RAW_POSITIONS = {
    'Leg': 7,
    'Water Depth (meter)': 8,
    'Panjang (km)': 10,
    'Diameter (inch)': 12,
    'Topsides/Deck': 14,
    'Jacket': 15,
    'Piles': 16,
    'Conductor': 17,
    'substructure': 25,         # COST - SUBSTRUCTURES -> Subtotal
    'topside_deck': 44,         # TOPSIDE Deck Structure -> Sub-Total.1
    'topside_production': 50,   # TOPSIDE Production Facilities -> Sub-Total.2
    'pipeline': 76,              # Pipeline -> Sub-Total.5
    'certification': 86,        # Certification and Permit
    'general_support': 92,      # General Support -> Sub Total General Support
}

DISPLAY_NAMES = {
    'substructure': 'Substructure',
    'pipeline': 'Pipeline',
    'topside_deck': 'Topside Deck Structure',
    'topside_production': 'Topside Production',
    'certification': 'Certification and Permit',
    'general_support': 'General Support',
}

# ============================================================
# CLEANING HELPERS
# ============================================================
def numeric(value):
    if pd.isna(value):
        return np.nan
    if isinstance(value, (int, float, np.integer, np.floating)):
        return float(value)
    s = str(value).strip().replace(',', '.')
    # Keep the first/last sensible numeric token.
    vals = re.findall(r'[-+]?\d+(?:\.\d+)?', s)
    if not vals:
        return np.nan
    try:
        return float(vals[0])
    except ValueError:
        return np.nan


def clean_pipe_length(value):
    if pd.isna(value):
        return np.nan
    s = str(value).strip()
    # Convert semicolon-separated values such as '67,2 km; 3,5 km'
    # into the total length.
    parts = re.findall(r'[-+]?\d+(?:[,.]\d+)?', s)
    vals = []
    for p in parts:
        try:
            vals.append(float(p.replace(',', '.')))
        except ValueError:
            pass
    return float(sum(vals)) if vals else np.nan


def clean_pipe_diameter(value):
    if pd.isna(value):
        return np.nan
    s = str(value).strip()
    parts = re.findall(r'[-+]?\d+(?:[,.]\d+)?', s)
    vals = []
    for p in parts:
        try:
            vals.append(float(p.replace(',', '.')))
        except ValueError:
            pass
    return float(max(vals)) if vals else np.nan

# ============================================================
# LOAD AND BUILD DATASET FROM RAW
# ============================================================
raw = pd.read_excel(FILE_PATH, sheet_name=SHEET_NAME, header=HEADER_ROW)

# Extract by physical column position so duplicate subtotal names are handled safely.
data = pd.DataFrame()
for name, pos in RAW_POSITIONS.items():
    data[name] = raw.iloc[:, pos]

# Rename component targets to stable names.
for c in ['Leg', 'Water Depth (meter)', 'Topsides/Deck', 'Jacket', 'Piles', 'Conductor']:
    data[c] = data[c].apply(numeric)

data['Panjang (km)'] = data['Panjang (km)'].apply(clean_pipe_length)
data['Diameter (inch)'] = data['Diameter (inch)'].apply(clean_pipe_diameter)

for target in DISPLAY_NAMES:
    data[target] = data[target].apply(numeric)

# Engineering constraints / consistency used by the newest training approach.
data['Leg'] = data['Leg'].round()

# ============================================================
# GAUSSIAN COPULA SYNTHESIS
# ============================================================
def gaussian_copula_generate(real_data, n_rows, seed):
    if n_rows <= 0:
        return pd.DataFrame(columns=real_data.columns)

    rng = np.random.default_rng(seed)
    data = real_data.copy()
    cols = list(data.columns)

    normal = np.zeros((len(data), len(cols)), dtype=float)
    for j, col in enumerate(cols):
        x = pd.to_numeric(data[col], errors='coerce')
        med = x.median()
        if pd.isna(med):
            med = 0.0
        x = x.fillna(med).to_numpy(float)
        ranks = rankdata(x, method='average')
        u = np.clip(ranks / (len(x) + 1.0), 1e-6, 1 - 1e-6)
        normal[:, j] = norm.ppf(u)

    corr = np.corrcoef(normal, rowvar=False)
    corr = np.atleast_2d(corr)
    corr = (corr + corr.T) / 2
    eigvals, eigvecs = np.linalg.eigh(corr)
    eigvals = np.maximum(eigvals, 1e-8)
    corr = eigvecs @ np.diag(eigvals) @ eigvecs.T
    corr = (corr + corr.T) / 2

    z = rng.multivariate_normal(np.zeros(len(cols)), corr, size=n_rows)
    u_syn = norm.cdf(z)
    out = pd.DataFrame(index=range(n_rows))

    for j, col in enumerate(cols):
        original = pd.to_numeric(data[col], errors='coerce').dropna().sort_values().to_numpy(float)
        if len(original) == 0:
            out[col] = 0.0
            continue
        pos = u_syn[:, j] * (len(original) - 1)
        lo = np.floor(pos).astype(int)
        hi = np.ceil(pos).astype(int)
        frac = pos - lo
        out[col] = original[lo] * (1 - frac) + original[hi] * frac

    return out


def apply_constraints(syn, original):
    syn = syn.copy()
    nonnegative = [
        'Water Depth (meter)', 'Panjang (km)', 'Diameter (inch)',
        'Piles', 'Jacket', 'Topsides/Deck', 'Conductor'
    ]
    for c in nonnegative:
        if c in syn.columns:
            syn[c] = syn[c].clip(lower=0)
    if 'Leg' in syn.columns:
        syn['Leg'] = syn['Leg'].clip(original['Leg'].min(), original['Leg'].max()).round()
    for c in DISPLAY_NAMES:
        if c in syn.columns:
            syn[c] = syn[c].clip(lower=0)
    return syn

# ============================================================
# LOOCV WITH FOLD-WISE SYNTHETIC DATA
# ============================================================
def make_model():
    return XGBRegressor(**XGB_PARAMS)


def prepare_X(train_df, test_df, features):
    X_train = train_df[features].copy()
    X_test = test_df[features].copy()
    for c in features:
        X_train[c] = pd.to_numeric(X_train[c], errors='coerce')
        X_test[c] = pd.to_numeric(X_test[c], errors='coerce')
        med = X_train[c].median()
        if pd.isna(med):
            med = 0.0
        X_train[c] = X_train[c].fillna(med)
        X_test[c] = X_test[c].fillna(med)
    return X_train, X_test


def evaluate_fold(usable, features, target, fold, ratio):
    train_real = usable.drop(index=fold).reset_index(drop=True)
    test_row = usable.iloc[[fold]].copy()
    synth_n = len(train_real) * ratio

    if synth_n > 0:
        syn = gaussian_copula_generate(
            train_real,
            synth_n,
            seed=RANDOM_STATE + fold + ratio * 1000
        )
        syn = apply_constraints(syn, train_real)
        train_all = pd.concat([train_real, syn], ignore_index=True)
    else:
        train_all = train_real

    X_train, X_test = prepare_X(train_all, test_row, features)
    y_train = pd.to_numeric(train_all[target], errors='coerce').fillna(0.0)
    y_test = float(test_row[target].iloc[0])

    model = make_model()
    model.fit(X_train, y_train)
    pred = max(0.0, float(model.predict(X_test)[0]))
    return y_test, pred, synth_n


def evaluate_component(component, ratio):
    features = FEATURES[component]
    target = component
    usable = data[features + [target]].copy()
    usable[target] = pd.to_numeric(usable[target], errors='coerce')
    usable = usable.dropna(subset=[target]).reset_index(drop=True)
    n = len(usable)
    if n < 2:
        return None

    folds = Parallel(n_jobs=8, backend='loky')(
        delayed(evaluate_fold)(usable, features, target, fold, ratio)
        for fold in range(n)
    )
    y_true = [x[0] for x in folds]
    y_pred = [x[1] for x in folds]
    synthetic_total = sum(x[2] for x in folds)

    r2 = r2_score(y_true, y_pred) if len(set(y_true)) > 1 else np.nan
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))

    return {
        'Model': DISPLAY_NAMES[component],
        'Component': component,
        'Synthetic Ratio': ratio,
        'Real Observations': n,
        'Synthetic Observations (total across folds)': synthetic_total,
        'R2': r2,
        'MAE (USD)': mae,
        'RMSE (USD)': rmse,
    }

# ============================================================
# RUN EXPERIMENT
# ============================================================
print('=' * 90)
print('NEWEST XGBOOST MODEL — SYNTHETIC DATA RATIO EXPERIMENT')
print('=' * 90)
print(f'Dataset: {FILE_PATH} | Sheet: {SHEET_NAME}')
print(f'Ratios: {RATIOS}')
print('Validation: fold-wise Leave-One-Out Cross-Validation')
print('Synthetic generation: Gaussian Copula inside each training fold')
print()

results = []
for component in FEATURES:
    print(f'\n>>> {DISPLAY_NAMES[component]}')
    for ratio in RATIOS:
        row = evaluate_component(component, ratio)
        if row is None:
            continue
        results.append(row)
        print(
            f"  {ratio:>2}x | n={row['Real Observations']:>2} | "
            f"R2={row['R2']:.6f} | "
            f"MAE=${row['MAE (USD)']:,.0f} | "
            f"RMSE=${row['RMSE (USD)']:,.0f}"
        )

results_df = pd.DataFrame(results)

# Wide comparison tables.
r2_wide = results_df.pivot(index='Synthetic Ratio', columns='Model', values='R2')
mae_wide = results_df.pivot(index='Synthetic Ratio', columns='Model', values='MAE (USD)')
rmse_wide = results_df.pivot(index='Synthetic Ratio', columns='Model', values='RMSE (USD)')

# Export.
out_xlsx = 'newest_model_synthetic_ratio_experiment.xlsx'
out_csv = 'newest_model_synthetic_ratio_experiment_long.csv'
results_df.to_csv(out_csv, index=False)

with pd.ExcelWriter(out_xlsx, engine='openpyxl') as writer:
    results_df.to_excel(writer, sheet_name='All Results', index=False)
    r2_wide.to_excel(writer, sheet_name='R2 Comparison')
    mae_wide.to_excel(writer, sheet_name='MAE Comparison')
    rmse_wide.to_excel(writer, sheet_name='RMSE Comparison')

print('\n' + '=' * 90)
print('EXPERIMENT COMPLETE')
print('=' * 90)
print(f'Excel: {out_xlsx}')
print(f'CSV  : {out_csv}')

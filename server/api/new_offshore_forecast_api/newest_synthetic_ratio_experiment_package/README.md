# Newest XGBoost Synthetic-Ratio Experiment

This experiment is aligned with the supplied newest model artifacts:

- Six cost components: Substructure, Pipeline, Topside Deck Structure, Topside Production, Certification and Permit, General Support
- XGBoost: 300 estimators, learning rate 0.05, max depth 5, min child weight 3, subsample 0.8, column subsample 0.8, gamma 0.1, reg_alpha 0.1, reg_lambda 1.0
- Gaussian Copula synthetic-data generation
- Ratios: 0x, 1x, 2x, 3x, 5x, 10x, 15x, 20x
- Leave-One-Out Cross-Validation
- Synthetic data are generated inside each training fold to avoid leakage from the held-out project
- Metrics: R², MAE, RMSE

## Run

```bash
python synthetic_ratio_experiment_newest.py
```

The script exports:

- `newest_model_synthetic_ratio_experiment.xlsx`
- `newest_model_synthetic_ratio_experiment_long.csv`

The Excel workbook contains:

- All Results
- R2 Comparison
- MAE Comparison
- RMSE Comparison

## Notes

The experiment can be computationally expensive because every ratio/component is retrained under LOOCV. The script therefore parallelizes folds. The resulting metrics should be used as the experiment results only after the complete run finishes.

Do not replace unfinished or partial runs with invented values.

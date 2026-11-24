# Methodology sensitivity experiment

Explicit synthetic scenarios; no independently justified accuracy ground truth or live calibration dataset is available.

| Scenario | Base | Equal | Median | Freshness | Robust | State | HHI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| agreement | 95015 | 95016.666666666666666666666667 | 95000 | 95015 | 95015 | TRIPLE_SOURCE | 0.3400 |
| source_age | 95015 | 95016.666666666666666666666667 | 95000 | 95009.147862309363031989572 | 95009.147862309363031989572 | TRIPLE_SOURCE | 0.3790 |
| outlier | 111530 | 113366.666666666666666666666667 | 95100 | 111530 | Unavailable | DIVERGENT | 0.0000 |
| near_tolerance | 95276 | 95306.666666666666666666666667 | 95020 | 95276 | 95039.77439931007144403272228 | TRIPLE_SOURCE | 0.4763 |

Retain research defaults. No absolute accuracy, statistical probability or production calibration claim is supported.

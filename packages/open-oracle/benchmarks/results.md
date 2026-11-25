# Open Oracle local benchmark

Synthetic offline workload; not provider throughput, network latency, production capacity or absolute price accuracy.

Node v26.13.0; darwin arm64; Apple M4.

| Workload | Operations | Duration ms | Operations/s | Heap delta bytes |
| --- | --- | --- | --- | --- |
| synthetic_inventory_registration | 10000 | 14.52 | 688759 | 10087440 |
| triple_composite | 20000 | 1344.60 | 14874 | 1687272 |
| normalization | 100000 | 6.84 | 14627280 | 6806616 |
| three_timeframe_candle_generation | 20000 | 325.91 | 61366 | 3788800 |
| causal_replay | 3000 | 58.17 | 51570 | 17299576 |
| 10000_single_source_markets_batch_evaluation | 10000 | 139.47 | 71700 | 36701392 |

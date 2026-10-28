// React 19 要求显式声明处于 act 环境，否则每次 act() 都会往 stderr 打一条告警，
// 而 ink-testing-library 捕获的正是 stdout/stderr，告警会混进断言用的帧里。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

---
title: MySQL事务基本概念
slug: mysql-transaction-basics
date: 2026-04-18
description: MySQL事务基本概念
cover: ''
tags:
  - MySQL
categories:
  - 数据库
sticky: 0
publish: true
---

# MySQL事务基本概念

### 事务基本特性

- 原子性
    - 事务要么都执行成功，要么全部失败，不会出现部分成功，和部分失败的场景
- 一致性
    - 事务执行前后的数据状态，始终保持一致
- 隔离性
    - 并发执行的两个事务不互相干扰，一个事务执行过程中不能看见其他运行事务的中间态
- 持久性
    - 事务提交后，数据会持久化回数据库，不会被回滚

### 事务类型

#### 扁平事务

```plain
begin;
扣减A账户100
增加B账户100
commit;
```

### 带保存点的扁平事务

```plain
BEGIN;

INSERT INTO order_main ...;

SAVEPOINT sp1;

INSERT INTO order_item ...;

SAVEPOINT sp2;

INSERT INTO order_log ...;

-- 如果这里失败， 局部回退
ROLLBACK TO SAVEPOINT sp2;

COMMIT;
```

### 链式事务

多个事务首尾相连，一个事务提交后，自动开始下一个事务

比如订单流程：

#### 事务1

- 创建订单
- commit

#### 事务2

- 扣减库存
- commit

#### 事务3

- 写支付流水
- commit

如果事务3失败：

- 事务1、事务2已经提交，不能直接回滚
- 只能靠补偿逻辑处理

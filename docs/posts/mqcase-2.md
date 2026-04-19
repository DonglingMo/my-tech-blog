---
title: rocket迁移
slug: mqcase-2
date: 2026-04-19
description: ''
cover: ''
tags: []
categories: []
sticky: 0
publish: true
---

RocketMQ 机房数据同步计划

背景与当前拓扑

StockMqCluster

角色

旧机器（IDC）

新机器（ECS 10.8.20.x）

备注

NameServer

10.5.24.143 / 10.5.25.143

10.23.33.200（已切）

—

broker-a-m/s

10.5.25.144 / 10.5.24.144

10.8.20.102

IDC5，今天暂不迁数据

broker-b-m

10.7.8.172（10.4.12.145 已关机）

10.8.20.103

源：10.7.8.172

broker-b-s

10.23.33.171（已关闭）

10.8.20.105

源：10.7.8.172

broker-c-m

10.7.8.169

10.8.20.104

源：10.7.8.169

broker-c-s

10.7.8.173

（切换后下掉）

—

broker-d-m

10.7.8.171

10.8.20.105

源：10.7.8.171

broker-d-s

10.7.8.215

（切换后下掉）

—

控制台：http://10.4.98.44:8086

MqCloud-PimDatabus

角色

旧机器（IDC7）

新机器（ECS）

域名

NS / broker-a-m

10.7.8.119

10.8.20.47

pim.ns01.mid

NS / broker-b-m

10.7.9.117

10.8.20.100

pim.ns02.mid

NS / broker-c-m

10.7.9.118

10.8.20.101

pim.ns03.mid

旧 broker-a-s/b-s/c-s 切换后下掉（跨机复用同机器做多角色）。
控制台：http://10.7.8.119:8080，账号：admin / arch_mq

同步策略

采用两阶段：

冷同步：用 rsync 将旧 Master 的 store/ 目录（commitlog + consumequeue + index + checkpoint）快速拷贝到新机器，最大减少后续追追进度的时间。

热追同步：在新机器上将 broker 以 brokerId=1（Slave） 启动，注册到现有 NameServer，由主从复制自动追平差量。

今天只完成数据同步，不切换 NameServer 域名、不下线旧机器。

执行步骤

准备工作（在新机器上执行）

确认 RocketMQ 版本与旧机器一致（mqbroker -v），配置目录结构与旧机器保持相同路径（通常 /opt/rocketmq/ 或 /home/rocketmq/）。

Step 1：冷同步 store 目录

在旧 Master 机器上执行，将 store 目录 rsync 到新机器（保留文件属性，增量同步）。

#!/bin/bash

# ========== StockMqCluster 冷同步脚本 ==========

# 请根据实际 RocketMQ 部署路径修改 STORE_PATH

STORE_PATH="/opt/rocketmq/store"   # 旧机器上的 store 路径
ROCKETMQ_USER="rocketmq"           # 运行用户

# broker-b 同步：10.7.8.172 -> 10.8.20.103 / 10.8.20.105

echo "[$(date)] Syncing broker-b store from 10.7.8.172..."
rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.103:${STORE_PATH}/

rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.105:${STORE_PATH}/

echo "[$(date)] broker-b sync done."

# broker-c 同步：10.7.8.169 -> 10.8.20.104

echo "[$(date)] Syncing broker-c store from 10.7.8.169..."
rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.104:${STORE_PATH}/
echo "[$(date)] broker-c sync done."

# broker-d 同步：10.7.8.171 -> 10.8.20.105（如与 broker-b 复用同机器，注意路径区分）

echo "[$(date)] Syncing broker-d store from 10.7.8.171..."
rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.105:${STORE_PATH}/
echo "[$(date)] broker-d sync done."

# ========== MqCloud-PimDatabus 冷同步脚本 ==========

# 在 10.7.8.119 上执行

STORE_PATH="/opt/rocketmq/store"
ROCKETMQ_USER="rocketmq"

echo "[$(date)] Syncing pim broker-a from 10.7.8.119 -> 10.8.20.47..."
rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.47:${STORE_PATH}/
echo "[$(date)] pim broker-a sync done."

# 在 10.7.9.117 上执行 -> 10.8.20.100

rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.100:${STORE_PATH}/

# 在 10.7.9.118 上执行 -> 10.8.20.101

rsync -avzP --delete 
  -e "ssh -o StrictHostKeyChecking=no" 
  ${STORE_PATH}/ 
  ${ROCKETMQ_USER}@10.8.20.101:${STORE_PATH}/

注意：rsync 期间旧 Master 仍在接收消息，这是正常的，差量部分由下一阶段热追补全。

Step 2：配置新机器 broker.conf（以 Slave 模式加入）

以 broker-b 新机器（10.8.20.103）为例：

# /opt/rocketmq/conf/broker.conf（新机器）

brokerClusterName=StockMqCluster
brokerName=broker-b
brokerId=1                           # 1=Slave，让旧 Master 推数据过来
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

# 指向现有 NameServer（含新旧）

namesrvAddr=10.5.25.143:9876;10.23.33.200:9876

brokerIP1=10.8.20.103
listenPort=10911

storePathRootDir=/opt/rocketmq/store
storePathCommitLog=/opt/rocketmq/store/commitlog

MqCloud-PimDatabus 新机器（10.8.20.47）类似，brokerClusterName=MqCloud-PimDatabus，namesrvAddr 指向 10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876。

Step 3：启动新机器上的 Slave broker

# 在各新机器上执行

export JAVA_HOME=/usr/local/java
cd /opt/rocketmq/bin
nohup sh mqbroker -c /opt/rocketmq/conf/broker.conf > /opt/rocketmq/logs/broker.log 2>&1 &

Step 4：监控主从同步进度

#!/bin/bash

# 在新 Slave 机器上执行，查看与 Master 的 commitlog 差距

# 使用 RocketMQ admin 工具

NAMESRV="10.5.25.143:9876"   # StockMqCluster 用；PimDatabus 换对应 NS

# 查看集群状态（含 BrokerDiff 落后字节数）

sh /opt/rocketmq/bin/mqadmin clusterList -n ${NAMESRV}

# 持续监控（每30秒刷新）

watch -n 30 "sh /opt/rocketmq/bin/mqadmin clusterList -n ${NAMESRV} 2>/dev/null | grep -E 'broker|BID|DIFF'"

当 DIFF 列接近 0 时，表示主从同步基本追平。

Step 5：验证数据完整性

# 检查新 Slave 上 commitlog 文件数量与大小是否与 Master 接近

ls -lh /opt/rocketmq/store/commitlog/ | tail -5

# 在控制台查看 Topic 的最大 Offset（对比新旧）

sh /opt/rocketmq/bin/mqadmin topicStatus 
  -n 10.5.25.143:9876 
  -t STOCK_CHANGE_EVENT_TOPIC

注意事项

今天只同步数据，不切换域名、不下线旧 broker，切换域名为后续波次操作

rsync 期间需确认新旧机器之间网络可达（防火墙/安全组放通 22 端口）

新 Slave 以 brokerId=1 加入后，旧 Master 的 clusterList 中会看到新 Slave，属正常现象

PimDatabus 集群中旧机器同时承担 NS + Broker 双角色，新机器也需要同时部署 NameServer 进程（mqnamesrv），但 DNS 域名切换留到后续波次

如 store 目录超过几百 GB，rsync 阶段可能耗时较长，建议提前预判并安排在业务低峰期执行

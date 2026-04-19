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

# StockMqCluster 数据同步执行手册

> **执行日期**：2026-04-19  
> **目标**：将 broker-a/b/c/d 数据同步到新 ECS 机器，新机器以 Slave 模式接入集群追平数据  
> **原则**：今天只同步数据，**不切流量、不改域名、不下线旧机器**

---

## 机器对应关系

| broker 组 | 旧 Master（数据源） | 旧 Slave（最终下掉） | 新 ECS（目标） |
|---|---|---|---|
| broker-a | 10.5.25.144（IDC5-3） | 10.5.24.144 | **10.8.20.102** |
| broker-b | 10.7.8.172（IDC7，唯一活跃） | 10.23.33.171（已关闭） | **10.8.20.103** |
| broker-c | 10.7.8.169（IDC7） | 10.7.8.173 | **10.8.20.104** |
| broker-d | 10.7.8.171（IDC7） | 10.7.8.215 | **10.8.20.105** |

**当前有效 NameServer**：`10.5.25.143:9876;10.23.33.200:9876`  
**控制台**：http://10.4.98.44:8086

---

## Phase 0：预检 —— 确认路径、版本和 Master/Slave 角色

> 已通过 ps 确认各机器上跑的配置文件名，但**文件名不能直接判断是否为 Master**，需要读取配置文件中的 `brokerId` 字段。brokerId=0 是 Master，brokerId=1 是 Slave。

### 已确认的进程信息

| 机器 IP | 主机名 | 配置文件（相对路径） |
|---|---|---|
| 10.5.25.144 | kucun25144 | `./conf/2m-2s-sync/broker-a-s.properties` |
| 10.7.8.172 | mcartstafn8172 | `./conf/2m-2s-sync/broker-b-s.properties` |
| 10.7.8.171 | mcartstafn8171 | `conf/2m-2s-sync/broker-d.properties` |
| 10.7.8.169 | mcartstafn8169 | `conf/2m-2s-sync/broker-c.properties` |

配置文件路径为**相对路径**，需要先找到 RocketMQ 的安装目录（进程工作目录）才能得到绝对路径。

### ✅ 10.5.25.144（kucun25144）Phase 0 已完成

| 项目 | 确认值 |
|---|---|
| RMQ_HOME | `/root/alibaba-rocketmq` |
| 配置文件 | `/root/alibaba-rocketmq/conf/2m-2s-sync/broker-a-s.properties` |
| brokerId / brokerRole | **0 / ASYNC_MASTER**（文件名含 `-s` 但实际是 Master，正常） |
| brokerName | broker-a |
| STORE_PATH | `/data/rocketmq/store` |
| commitlog 大小 | **38G** |
| RocketMQ 版本 | **3.5.8** |
| Java 版本 | 1.8.0_131 |
| → 10.8.20.102 网络 | **OK** |

### ✅ 10.7.8.171（mcartstafn8171）Phase 0 已完成

| 项目 | 确认值 |
|---|---|
| RMQ_HOME | `/root/alibaba-rocketmq` |
| 配置文件 | `/root/alibaba-rocketmq/conf/2m-2s-sync/broker-d.properties` |
| brokerId / brokerRole | **0 / ASYNC_MASTER** |
| brokerName | broker-d |
| STORE_PATH | **`/d1/rocketmq/store`**（与 broker-b/c 相同） |
| commitlog 大小 | 待确认（`du -sh /d1/rocketmq/store/commitlog/`） |
| RocketMQ 版本 | **3.5.8** |
| Java 版本 | **1.7.0_05** |
| → 10.8.20.105 网络 | 待确认 |

### ✅ 10.7.8.169（mcartstafn8169）Phase 0 已完成

| 项目 | 确认值 |
|---|---|
| RMQ_HOME | `/root/alibaba-rocketmq` |
| 配置文件 | `/root/alibaba-rocketmq/conf/2m-2s-sync/broker-c.properties` |
| brokerId / brokerRole | **0 / ASYNC_MASTER** |
| brokerName | broker-c |
| STORE_PATH | **`/d1/rocketmq/store`**（与 broker-b 相同） |
| commitlog 大小 | 待确认（`du -sh /d1/rocketmq/store/commitlog/`） |
| RocketMQ 版本 | **3.5.8** |
| Java 版本 | **1.7.0_05** |
| → 10.8.20.104 网络 | 待确认 |

### ✅ 10.7.8.172（mcartstafn8172）Phase 0 已完成

| 项目 | 确认值 |
|---|---|
| RMQ_HOME | `/root/alibaba-rocketmq` |
| 配置文件 | `/root/alibaba-rocketmq/conf/2m-2s-sync/broker-b-s.properties` |
| brokerId / brokerRole | **0 / ASYNC_MASTER**（文件名含 `-s` 但实际是 Master，正常） |
| brokerName | broker-b |
| STORE_PATH | **`/d1/rocketmq/store`**（⚠️ 与 broker-a 不同） |
| commitlog 大小 | **38G** |
| RocketMQ 版本 | **3.5.8** |
| Java 版本 | **1.7.0_05**（⚠️ 与 broker-a 不同，新机器建议装同版本） |
| → 10.8.20.103 网络 | 待确认（nc 不可用，用 ssh 测试） |

---

### 0-1. 在 10.5.25.144（broker-a 机器）执行

```bash
# Step 1: 找到 RocketMQ 安装目录（进程的工作目录）
BROKER_PID=$(pgrep -f mqbroker | head -1)
RMQ_HOME=$(ls -la /proc/${BROKER_PID}/cwd | awk '{print $NF}')
echo "RocketMQ 安装目录: ${RMQ_HOME}"

# Step 2: 确认配置文件绝对路径
BROKER_CONF="${RMQ_HOME}/conf/2m-2s-sync/broker-a-s.properties"
echo "配置文件: ${BROKER_CONF}"
ls -la ${BROKER_CONF}

# Step 3: ⚠️ 确认是否为 Master（brokerId=0 是 master，brokerId=1 是 slave）
grep -E "brokerId|brokerRole|brokerName" ${BROKER_CONF}

# Step 4: 查看 store 路径和数据量
grep -E "storePathRootDir|storePathCommitLog" ${BROKER_CONF}
STORE_PATH=$(grep storePathRootDir ${BROKER_CONF} | awk -F= '{print $2}' | tr -d ' ')
echo "Store 路径: ${STORE_PATH}"
du -sh ${STORE_PATH}/commitlog/

# Step 5: 确认 RocketMQ 版本
ls ${RMQ_HOME}/lib/ | grep rocketmq-broker | head -3

# Step 6: 确认 Java 版本
java -version

# Step 7: 测试到新机器的网络
nc -zv 10.8.20.102 22 -w 3 && echo "10.8.20.102 OK" || echo "10.8.20.102 FAIL"
```

> **如果 brokerId=1（Slave）**，数据源应改为 broker-a 的 Master 机器，请查看配置文件中 `haMasterAddress` 或联系相关同学确认 Master IP。

---

### 0-2. 在 10.7.8.172（broker-b 机器）执行

```bash
BROKER_PID=$(pgrep -f mqbroker | head -1)
RMQ_HOME=$(ls -la /proc/${BROKER_PID}/cwd | awk '{print $NF}')
echo "RocketMQ 安装目录: ${RMQ_HOME}"

BROKER_CONF="${RMQ_HOME}/conf/2m-2s-sync/broker-b-s.properties"
echo "配置文件: ${BROKER_CONF}"

# ⚠️ 确认是否为 Master
grep -E "brokerId|brokerRole|brokerName" ${BROKER_CONF}

grep -E "storePathRootDir|storePathCommitLog" ${BROKER_CONF}
STORE_PATH=$(grep storePathRootDir ${BROKER_CONF} | awk -F= '{print $2}' | tr -d ' ')
echo "Store 路径: ${STORE_PATH}"
du -sh ${STORE_PATH}/commitlog/

ls ${RMQ_HOME}/lib/ | grep rocketmq-broker | head -3
java -version

nc -zv 10.8.20.103 22 -w 3 && echo "10.8.20.103 OK" || echo "10.8.20.103 FAIL"
```

> **注意**：原 broker-b master（10.4.12.145）已于 20260331 关机。若此机 brokerId=1（Slave），则 broker-b 目前没有活跃 Master，需要确认是否需要先将此 Slave 提升为 Master，或直接从 Slave 同步数据。

---

### 0-3. 在 10.7.8.169（broker-c 机器）执行

```bash
BROKER_PID=$(pgrep -f mqbroker | head -1)
RMQ_HOME=$(ls -la /proc/${BROKER_PID}/cwd | awk '{print $NF}')
echo "RocketMQ 安装目录: ${RMQ_HOME}"

BROKER_CONF="${RMQ_HOME}/conf/2m-2s-sync/broker-c.properties"

# ⚠️ 确认是否为 Master
grep -E "brokerId|brokerRole|brokerName" ${BROKER_CONF}

grep -E "storePathRootDir|storePathCommitLog" ${BROKER_CONF}
STORE_PATH=$(grep storePathRootDir ${BROKER_CONF} | awk -F= '{print $2}' | tr -d ' ')
echo "Store 路径: ${STORE_PATH}"
du -sh ${STORE_PATH}/commitlog/

ls ${RMQ_HOME}/lib/ | grep rocketmq-broker | head -3
java -version

nc -zv 10.8.20.104 22 -w 3 && echo "10.8.20.104 OK" || echo "10.8.20.104 FAIL"
```

---

### 0-4. 在 10.7.8.171（broker-d 机器）执行

```bash
BROKER_PID=$(pgrep -f mqbroker | head -1)
RMQ_HOME=$(ls -la /proc/${BROKER_PID}/cwd | awk '{print $NF}')
echo "RocketMQ 安装目录: ${RMQ_HOME}"

BROKER_CONF="${RMQ_HOME}/conf/2m-2s-sync/broker-d.properties"

# ⚠️ 确认是否为 Master
grep -E "brokerId|brokerRole|brokerName" ${BROKER_CONF}

grep -E "storePathRootDir|storePathCommitLog" ${BROKER_CONF}
STORE_PATH=$(grep storePathRootDir ${BROKER_CONF} | awk -F= '{print $2}' | tr -d ' ')
echo "Store 路径: ${STORE_PATH}"
du -sh ${STORE_PATH}/commitlog/

ls ${RMQ_HOME}/lib/ | grep rocketmq-broker | head -3
java -version

nc -zv 10.8.20.105 22 -w 3 && echo "10.8.20.105 OK" || echo "10.8.20.105 FAIL"
```

---

### 0-5. 记录预检结果（填写后继续）

```
# 四台机器（路径通常相同）
RMQ_HOME=__________________     # 例：/data/rocketmq  或  /home/admin/rocketmq
STORE_PATH=__________________   # 例：/data/rocketmq/store
RMQ_VERSION=________________    # 例：4.9.4
JAVA_HOME=__________________    # 例：/usr/local/jdk1.8.0_291
REMOTE_USER=________________    # 新机器登录用户，例：root

# 角色确认（填写 brokerId 值）
broker-a (10.5.25.144) brokerId = ___   brokerRole = ___
broker-b (10.7.8.172)  brokerId = ___   brokerRole = ___
broker-c (10.7.8.169)  brokerId = ___   brokerRole = ___
broker-d (10.7.8.171)  brokerId = ___   brokerRole = ___
```

**预检 Checklist**

- [ ] 10.5.25.144 RMQ_HOME 绝对路径已确认
- [ ] 10.7.8.172 RMQ_HOME 绝对路径已确认
- [ ] 10.7.8.169 RMQ_HOME 绝对路径已确认
- [ ] 10.7.8.171 RMQ_HOME 绝对路径已确认
- [ ] 四台机器 brokerId / brokerRole 已确认（判断是否为 Master）
- [ ] 10.5.25.144 → 10.8.20.102 网络可达
- [ ] 10.7.8.172 → 10.8.20.103 网络可达
- [ ] 10.7.8.169 → 10.8.20.104 网络可达
- [ ] 10.7.8.171 → 10.8.20.105 网络可达
- [ ] store 路径和数据量已记录
- [ ] RocketMQ 版本已确认

---

## Phase 1：新 ECS 部署 RocketMQ

> 各新机器 store 路径不同，需分机器执行。打包命令在对应**旧机器**上执行，解压在**新机器**上执行。

### 1-a. 10.8.20.102（broker-a 新机器，store 在 /data）

**在旧机器 10.5.25.144 上打包：**

```bash
tar czf /tmp/rocketmq_pkg.tar.gz -C /root alibaba-rocketmq
scp /tmp/rocketmq_pkg.tar.gz root@10.8.20.102:/tmp/
```

**在新机器 10.8.20.102 上执行：**

```bash
# 解压安装
tar xzf /tmp/rocketmq_pkg.tar.gz -C /root/
ls /root/alibaba-rocketmq/bin/mqbroker   # 确认存在

# 创建 store 目录（broker-a 路径：/data/rocketmq/store）
mkdir -p /data/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /root/alibaba-rocketmq/logs/rocketmqlogs

# 确认 Java（broker-a 旧机器用 1.8，新机器保持一致）
java -version
echo "JAVA_HOME=${JAVA_HOME}"
# 若 JAVA_HOME 为空：export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))

# 确认端口未占用
ss -tlnp | grep -E ":10911|:10912|:10909"
```

### 1-b. 10.8.20.103（broker-b 新机器，store 在 /d1）

**在旧机器 10.7.8.172 上打包：**

```bash
tar czf /tmp/rocketmq_pkg.tar.gz -C /root alibaba-rocketmq
scp /tmp/rocketmq_pkg.tar.gz root@10.8.20.103:/tmp/
```

**在新机器 10.8.20.103 上执行：**

```bash
# 解压安装
tar xzf /tmp/rocketmq_pkg.tar.gz -C /root/
ls /root/alibaba-rocketmq/bin/mqbroker

# 创建 store 目录（broker-b 路径：/d1/rocketmq/store）
mkdir -p /d1/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /root/alibaba-rocketmq/logs/rocketmqlogs

# 确认 Java（broker-b 旧机器用 1.7，新机器保持一致）
java -version
echo "JAVA_HOME=${JAVA_HOME}"
# 若 JAVA_HOME 为空：export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))

# 确认端口未占用
ss -tlnp | grep -E ":10911|:10912|:10909"
```

### 1-c. 10.8.20.104（broker-c 新机器，store 在 /d1）

**在旧机器 10.7.8.169 上打包：**

```bash
tar czf /tmp/rocketmq_pkg.tar.gz -C /root alibaba-rocketmq
scp /tmp/rocketmq_pkg.tar.gz root@10.8.20.104:/tmp/
```

**在新机器 10.8.20.104 上执行：**

```bash
# 解压安装
tar xzf /tmp/rocketmq_pkg.tar.gz -C /root/
ls /root/alibaba-rocketmq/bin/mqbroker

# 创建 store 目录（broker-c 路径：/d1/rocketmq/store，与 broker-b 相同）
mkdir -p /d1/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /root/alibaba-rocketmq/logs/rocketmqlogs

java -version
echo "JAVA_HOME=${JAVA_HOME}"
# 若 JAVA_HOME 为空：export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
ss -tlnp | grep -E ":10911|:10912|:10909"
```

### 1-d. 10.8.20.105（broker-d 新机器，store 在 /d1）

**在旧机器 10.7.8.171 上打包：**

```bash
tar czf /tmp/rocketmq_pkg.tar.gz -C /root alibaba-rocketmq
scp /tmp/rocketmq_pkg.tar.gz root@10.8.20.105:/tmp/
```

**在新机器 10.8.20.105 上执行：**

```bash
# 解压安装
tar xzf /tmp/rocketmq_pkg.tar.gz -C /root/
ls /root/alibaba-rocketmq/bin/mqbroker

# 创建 store 目录（broker-d 路径：/d1/rocketmq/store，与 broker-b/c 相同）
mkdir -p /d1/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /root/alibaba-rocketmq/logs/rocketmqlogs

java -version
echo "JAVA_HOME=${JAVA_HOME}"
# 若 JAVA_HOME 为空：export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
ss -tlnp | grep -E ":10911|:10912|:10909"
```

**Phase 1 Checklist**

- [x] 10.8.20.102 RocketMQ 解压完成（broker-a，/data/rocketmq/store 已创建）
- [ ] 10.8.20.103 RocketMQ 解压完成（broker-b，/d1/rocketmq/store 已创建）
- [ ] 10.8.20.104 RocketMQ 解压完成（broker-c，store 路径待确认）
- [ ] 10.8.20.105 RocketMQ 解压完成（broker-d，store 路径待确认）

---

## Phase 2：冷同步 store 数据（四组并行执行）

> 在**旧机器**上执行，数据推送到对应新 ECS。rsync 期间旧机器持续服务，差量由 Phase 4 主从复制追平。  
> ⚠️ **执行前必须完成 Phase 0**：确认 STORE_PATH 实际值，以及确认每台机器是 Master 还是 Slave。  
> `--bwlimit=102400` = 限速 100MB/s，如 I/O 压力大可调低到 51200（50MB/s）。

### 2-a. 在 10.5.25.144（kucun25144）上执行 → 同步到 10.8.20.102（broker-a）

```bash
echo "[$(date '+%F %T')] 开始同步 broker-a -> 10.8.20.102"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /data/rocketmq/store/ \
  root@10.8.20.102:/data/rocketmq/store/ \
  > /tmp/rsync_broker_a_102.log 2>&1 &

echo "rsync PID: ${!}  |  查看进度: tail -f /tmp/rsync_broker_a_102.log"
```

### 2-b. 在 10.7.8.172（mcartstafn8172）上执行 → 同步到 10.8.20.103（broker-b）

> ⚠️ broker-b 的 store 路径是 `/d1/rocketmq/store`（不是 /data），新机器目录需提前创建。

```bash
# 先在新机器 10.8.20.103 上创建目录（路径与旧机器一致）
# ssh root@10.8.20.103 "mkdir -p /d1/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}"

echo "[$(date '+%F %T')] 开始同步 broker-b -> 10.8.20.103"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /d1/rocketmq/store/ \
  root@10.8.20.103:/d1/rocketmq/store/ \
  > /tmp/rsync_broker_b_103.log 2>&1 &

echo "rsync PID: ${!}  |  查看进度: tail -f /tmp/rsync_broker_b_103.log"
```

### 2-c. 在 10.7.8.169（mcartstafn8169）上执行 → 同步到 10.8.20.104（broker-c）

> store 路径为 `/d1/rocketmq/store`，与 broker-b 相同。

```bash
# 先在新机器 10.8.20.104 上创建目录（如 Phase 1 已创建可跳过）
# ssh root@10.8.20.104 "mkdir -p /d1/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}"

echo "[$(date '+%F %T')] 开始同步 broker-c -> 10.8.20.104"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /d1/rocketmq/store/ \
  root@10.8.20.104:/d1/rocketmq/store/ \
  > /tmp/rsync_broker_c_104.log 2>&1 &

echo "rsync PID: ${!}  |  查看进度: tail -f /tmp/rsync_broker_c_104.log"
```

### 2-d. 在 10.7.8.171（mcartstafn8171）上执行 → 同步到 10.8.20.105（broker-d）

> store 路径为 `/d1/rocketmq/store`，与 broker-b/c 相同。

```bash
# 先在新机器 10.8.20.105 上创建目录（如 Phase 1 已创建可跳过）
# ssh root@10.8.20.105 "mkdir -p /d1/rocketmq/store/{commitlog,consumequeue,index,checkpoint,abort}"

echo "[$(date '+%F %T')] 开始同步 broker-d -> 10.8.20.105"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /d1/rocketmq/store/ \
  root@10.8.20.105:/d1/rocketmq/store/ \
  > /tmp/rsync_broker_d_105.log 2>&1 &

echo "rsync PID: ${!}  |  查看进度: tail -f /tmp/rsync_broker_d_105.log"
```

### 2-e. 查看同步进度（在各旧机器上）

```bash
# 查看进度（文件名、传输速度、百分比）
tail -20 /tmp/rsync_broker_a_102.log   # broker-a 机器上
tail -20 /tmp/rsync_broker_b_103.log   # broker-b 机器上
tail -20 /tmp/rsync_broker_c_104.log   # broker-c 机器上
tail -20 /tmp/rsync_broker_d_105.log   # broker-d 机器上

# rsync 结束后末尾应出现类似：
# sent 123,456,789 bytes  received 1,234 bytes  ...
# total size is 123,456,789  speedup is 1.00
```

### 2-f. rsync 完成后在新机器验证数据量

```bash
# 在各新机器上执行（路径已确认）
du -sh /data/rocketmq/store/commitlog/

# 预期大小参考（Phase 0 记录）：
# broker-a (10.8.20.102)：≈ 38G（10.5.25.144 实测值）
# broker-b (10.8.20.103)：待 Phase 0 其他机器执行后补充
# broker-c (10.8.20.104)：待 Phase 0 其他机器执行后补充
# broker-d (10.8.20.105)：待 Phase 0 其他机器执行后补充
# rsync 期间有新消息写入，新机器可能略小，属正常
```

**Phase 2 Checklist**

- [ ] broker-a rsync 完成（/tmp/rsync_broker_a_102.log 末行有 total size）
- [ ] broker-b rsync 完成（/tmp/rsync_broker_b_103.log 末行有 total size）
- [ ] broker-c rsync 完成（/tmp/rsync_broker_c_104.log 末行有 total size）
- [ ] broker-d rsync 完成（/tmp/rsync_broker_d_105.log 末行有 total size）
- [ ] 新机器 commitlog 目录大小与旧机器相近

---

## Phase 3：写 broker.conf（新机器 Slave 模式）

> **在四台新 ECS 上执行**。路径已根据 Phase 0 结果填入，直接复制粘贴执行即可。  
> ⚠️ RocketMQ 版本为 3.5.8，conf 文件写在 `/root/alibaba-rocketmq/conf/` 下。

### 3-a. 在 10.8.20.102（broker-a 新机器）执行

```bash
mkdir -p /root/alibaba-rocketmq/conf

cat > /root/alibaba-rocketmq/conf/broker.conf << 'EOF'
brokerClusterName=StockMqCluster
brokerName=broker-a
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.5.25.143:9876;10.23.33.200:9876
brokerIP1=10.8.20.102
listenPort=10911

storePathRootDir=/data/rocketmq/store
storePathCommitLog=/data/rocketmq/store/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.102 broker.conf ===" && cat /root/alibaba-rocketmq/conf/broker.conf
```

### 3-b. 在 10.8.20.103（broker-b 新机器）执行

> ⚠️ broker-b store 路径为 `/d1/rocketmq/store`，与 broker-a 不同。

```bash
mkdir -p /root/alibaba-rocketmq/conf

cat > /root/alibaba-rocketmq/conf/broker.conf << 'EOF'
brokerClusterName=StockMqCluster
brokerName=broker-b
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.5.25.143:9876;10.23.33.200:9876
brokerIP1=10.8.20.103
listenPort=10911

storePathRootDir=/d1/rocketmq/store
storePathCommitLog=/d1/rocketmq/store/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.103 broker.conf ===" && cat /root/alibaba-rocketmq/conf/broker.conf
```

### 3-c. 在 10.8.20.104（broker-c 新机器）执行

> broker-c store 路径为 `/d1/rocketmq/store`，与 broker-b 相同。

```bash
mkdir -p /root/alibaba-rocketmq/conf

cat > /root/alibaba-rocketmq/conf/broker.conf << 'EOF'
brokerClusterName=StockMqCluster
brokerName=broker-c
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.5.25.143:9876;10.23.33.200:9876
brokerIP1=10.8.20.104
listenPort=10911

storePathRootDir=/d1/rocketmq/store
storePathCommitLog=/d1/rocketmq/store/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.104 broker.conf ===" && cat /root/alibaba-rocketmq/conf/broker.conf
```

### 3-d. 在 10.8.20.105（broker-d 新机器）执行

> broker-d store 路径为 `/d1/rocketmq/store`，与 broker-b/c 相同。

```bash
mkdir -p /root/alibaba-rocketmq/conf

cat > /root/alibaba-rocketmq/conf/broker.conf << 'EOF'
brokerClusterName=StockMqCluster
brokerName=broker-d
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.5.25.143:9876;10.23.33.200:9876
brokerIP1=10.8.20.105
listenPort=10911

storePathRootDir=/d1/rocketmq/store
storePathCommitLog=/d1/rocketmq/store/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.105 broker.conf ===" && cat /root/alibaba-rocketmq/conf/broker.conf
```

**Phase 3 Checklist**

- [ ] 10.8.20.102 broker.conf 写入，brokerName=broker-a，brokerIP1=10.8.20.102
- [ ] 10.8.20.103 broker.conf 写入，brokerName=broker-b，brokerIP1=10.8.20.103
- [ ] 10.8.20.104 broker.conf 写入，brokerName=broker-c，brokerIP1=10.8.20.104
- [ ] 10.8.20.105 broker.conf 写入，brokerName=broker-d，brokerIP1=10.8.20.105

---

## Phase 4：启动新 broker（四台并行）

> **在四台新 ECS 上各执行**。  
> JAVA_HOME 若未设置，先执行：`export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))`

```bash
# ====== 在每台新 ECS 机器上执行 ======

export JAVA_HOME=/usr/local/jdk   # 新 ECS 机器已确认
echo "JAVA_HOME=${JAVA_HOME}"

# 查看旧机器 JVM 参数作参考（在 10.5.25.144 等旧机器上执行）：
# grep -E "Xms|Xmx|Xmn" /root/alibaba-rocketmq/bin/runbroker.sh

# Slave 机器 JVM 参数（版本 3.5.8，建议与旧机器保持一致）
export JAVA_OPT_EXT="-server -Xms4g -Xmx4g -Xmn2g"

mkdir -p /root/alibaba-rocketmq/logs/rocketmqlogs

nohup sh /root/alibaba-rocketmq/bin/mqbroker \
  -c /root/alibaba-rocketmq/conf/broker.conf \
  > /root/alibaba-rocketmq/logs/broker-startup.log 2>&1 &

echo "broker 启动 PID: $!"

# 等待 8 秒后查看启动日志
sleep 8
tail -50 /root/alibaba-rocketmq/logs/broker-startup.log

# 关键成功日志（任意一条均表示启动成功）：
# The broker[broker-x, ...] boot success
# register broker to name server ... OK
```

### 4-e. 验证四台 Slave 全部注册（在旧机器或新机器上执行）

```bash
sh /root/alibaba-rocketmq/bin/mqadmin clusterList \
  -n "10.5.25.143:9876;10.23.33.200:9876"
```

正常输出应包含：

```
broker-a  BID=0  10.5.25.144  ...   （旧 Master，一直在）
broker-a  BID=1  10.8.20.102  ...   ← 新加入 ✓
broker-b  BID=0  10.7.8.172   ...
broker-b  BID=1  10.8.20.103  ...   ← 新加入 ✓
broker-c  BID=0  10.7.8.169   ...
broker-c  BID=1  10.8.20.104  ...   ← 新加入 ✓
broker-d  BID=0  10.7.8.171   ...
broker-d  BID=1  10.8.20.105  ...   ← 新加入 ✓
```

**Phase 4 Checklist**

- [ ] 10.8.20.102 broker 启动成功，日志有 boot success
- [ ] 10.8.20.103 broker 启动成功，日志有 boot success
- [ ] 10.8.20.104 broker 启动成功，日志有 boot success
- [ ] 10.8.20.105 broker 启动成功，日志有 boot success
- [ ] clusterList 中四台新机器均以 BID=1 出现

---

## Phase 5：监控同步进度

> 新 Slave 启动后自动通过 HA 复制协议向 Master 追平差量。

### 5-a. 持续监控 DIFF 值（每 30 秒刷新）

```bash
# 在任意机器执行（旧 IDC 机器或新 ECS 均可）
watch -n 30 "sh /root/alibaba-rocketmq/bin/mqadmin clusterList \
  -n '10.5.25.143:9876;10.23.33.200:9876' 2>/dev/null"
```

**DIFF 列说明**：
- 启动初期 DIFF 较大（可能数 GB），属正常
- 随时间持续下降说明同步正常
- **DIFF 稳定在 < 1MB（约 1048576）即追平完成**

### 5-b. 在新 Slave 机器上查看 HA 同步日志

```bash
# 在新机器（如 10.8.20.103）上执行
grep -E "HAClient|haAddress|transfer" \
  /root/alibaba-rocketmq/logs/rocketmqlogs/broker.log | tail -20

# 正常应看到类似：
# HAClient: report slave max offset ...
# HAClient: slave close, retry connect
```

### 5-c. 对比新旧 commitlog 大小

```bash
# 在旧机器和新机器上分别执行，大小应越来越接近
du -sh /data/rocketmq/store/commitlog/
```

**Phase 5 Checklist**

- [ ] broker-a DIFF 持续下降
- [ ] broker-b DIFF 持续下降
- [ ] broker-c DIFF 持续下降
- [ ] broker-d DIFF 持续下降
- [ ] 四个 broker 组 DIFF 均 < 1MB，宣告数据同步完成 ✓

---

## 今天完成后的状态

| 机器 | 角色 | 状态 |
|---|---|---|
| 10.5.25.144 | broker-a Master（旧） | 继续服务，不动 |
| 10.7.8.172 | broker-b Master（旧） | 继续服务，不动 |
| 10.7.8.169 | broker-c Master（旧） | 继续服务，不动 |
| 10.7.8.171 | broker-d Master（旧） | 继续服务，不动 |
| **10.8.20.102** | broker-a Slave（新） | **新加入，持续追平** |
| **10.8.20.103** | broker-b Slave（新） | **新加入，持续追平** |
| **10.8.20.104** | broker-c Slave（新） | **新加入，持续追平** |
| **10.8.20.105** | broker-d Slave（新） | **新加入，持续追平** |

切换流量、下线旧机器为后续波次操作，今天不涉及。

---

## 常见问题排查

**Q：新机器 clusterList 中看不到**  
→ 检查新机器防火墙/安全组是否放通了 `10911`、`10912`、`10909` 端口  
→ 检查 broker.conf 中 `namesrvAddr` 是否正确  
→ 查看 `broker-startup.log` 有无 exception

**Q：rsync 报 Permission denied**  
→ 检查新机器 SSH 免密是否配置（或确认 REMOTE_USER 正确）  
→ 可用 `ssh-copy-id ${REMOTE_USER}@10.8.20.10x` 先配置

**Q：DIFF 值不下降甚至增大**  
→ 检查旧 Master 与新 Slave 之间 `10912` 端口（HA 同步端口）是否可达  
→ 查看新 Slave 日志中 HAClient 相关错误  
→ 检查新 Slave 磁盘空间是否充足：`df -h`

**Q：新机器 broker 启动后立即退出**  
→ 查看 `/root/alibaba-rocketmq/logs/broker-startup.log` 末尾错误  
→ 常见原因：JAVA_HOME 未设置（`echo $JAVA_HOME` 为空）、store 目录权限不足、端口已被占用  
→ JAVA_HOME 修复：`export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))`

---
# MqCloud-PimDatabus 数据同步执行手册

> **执行日期**：2026-04-19  
> **目标**：将 broker-a/b/c 数据同步到新 ECS 机器，新机器以 Slave 模式接入集群追平数据，同时部署新 NameServer（但今天不切 DNS）  
> **原则**：今天只同步数据，**不切流量、不改 DNS 域名、不下线旧机器**

---

## 集群拓扑

> 每台旧机器同时承担 **NameServer + 两套独立 RocketMQ（Master + Slave）**

| 旧机器 | 角色 | 目录 | STORE_PATH | 端口 |
|---|---|---|---|---|
| **10.7.8.119** | broker-a **Master** | `rocketmq-all-4.6.1-bin-release` | `/rocketmq-data/data` | 10911 |
| **10.7.8.119** | broker-c Slave | `rocketmq-all-4.6.1-bin-release-01` | `/rocketmq-data/data-01` | 10916 |
| **10.7.9.117** | broker-b **Master** | `rocketmq-all-4.6.1-bin-release` | `/rocketmq-data/data` | 10911 |
| **10.7.9.117** | broker-a Slave | `rocketmq-all-4.6.1-bin-release-01` | `/rocketmq-data/data-01` | 10916 |
| **10.7.9.118** | broker-c **Master** | `rocketmq-all-4.6.1-bin-release` | `/rocketmq-data/data` | 10911 |
| **10.7.9.118** | broker-b Slave | `rocketmq-all-4.6.1-bin-release-01` | `/rocketmq-data/data-01` | 10916 |

## 机器映射关系（今天操作范围）

| broker 组 | 旧 Master（数据源） | 新 ECS（目标） | 新 NS 域名 |
|---|---|---|---|
| broker-a | **10.7.8.119** | **10.8.20.47** | pim.ns01.mid |
| broker-b | **10.7.9.117** | **10.8.20.100** | pim.ns02.mid |
| broker-c | **10.7.9.118** | **10.8.20.101** | pim.ns03.mid |

**旧 NameServer**：`10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876`  
**控制台**：http://10.7.8.119:8080（admin / arch_mq）

---

## Phase 0：预检结果（已完成）

### 10.7.8.119

| 项目 | 值 |
|---|---|
| broker-a Master RMQ_HOME | `/usr/local/rocketmq/rocketmq-all-4.6.1-bin-release` |
| broker-a STORE_PATH | `/rocketmq-data/data` |
| broker-a commitlog 大小 | **42G** |
| RocketMQ 版本 | 4.6.1 |
| Java 版本 | 1.8.0_131 |
| SSH → 10.8.20.47 | **✅ 免密已配** |

### 10.7.9.117

| 项目 | 值 |
|---|---|
| broker-b Master RMQ_HOME | `/usr/local/rocketmq/rocketmq-all-4.6.1-bin-release` |
| broker-b STORE_PATH | `/rocketmq-data/data` |
| SSH → 10.8.20.100 | 待配免密 |

### 10.7.9.118

| 项目 | 值 |
|---|---|
| broker-c Master RMQ_HOME | `/usr/local/rocketmq/rocketmq-all-4.6.1-bin-release` |
| broker-c STORE_PATH | `/rocketmq-data/data` |
| SSH → 10.8.20.101 | 待配免密 |

> 三台旧机器规律完全相同：  
> `rocketmq-all-4.6.1-bin-release` = Master，STORE=`/rocketmq-data/data`  
> `rocketmq-all-4.6.1-bin-release-01` = Slave，STORE=`/rocketmq-data/data-01`（**今天不同步**）

**预检 Checklist**

- [x] 10.7.8.119 broker-a 路径、版本已确认，commitlog=42G
- [x] 10.7.9.117 broker-b 路径已确认（commitlog 大小待补测）
- [x] 10.7.9.118 broker-c 路径已确认（commitlog 大小待补测）
- [x] 10.7.8.119 → 10.8.20.47 免密 SSH 已配
- [ ] 10.7.9.117 → 10.8.20.100 免密 SSH 待配
- [ ] 10.7.9.118 → 10.8.20.101 免密 SSH 待配

---

## Phase 1：新 ECS 部署 RocketMQ

> 三台新机器路径统一：  
> RMQ_HOME = `/usr/local/rocketmq/rocketmq-all-4.6.1-bin-release`  
> STORE_PATH = `/rocketmq-data/data`

### 1-a. 10.8.20.47（broker-a 新机器）

**在旧机器 10.7.8.119 上打包（只打 Master 那套安装目录）：**

```bash
tar czf /tmp/rocketmq_pim_pkg.tar.gz \
  -C /usr/local/rocketmq rocketmq-all-4.6.1-bin-release

scp /tmp/rocketmq_pim_pkg.tar.gz root@10.8.20.47:/tmp/
```

**在新机器 10.8.20.47 上执行：**

```bash
mkdir -p /usr/local/rocketmq
tar xzf /tmp/rocketmq_pim_pkg.tar.gz -C /usr/local/rocketmq/

ls /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqbroker
ls /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqnamesrv

# 创建 store 目录
mkdir -p /rocketmq-data/data/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs

java -version
echo "JAVA_HOME=${JAVA_HOME}"
# 若为空：export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))

# 确认端口未占用
ss -tlnp | grep -E ":10911|:10912|:10909|:9876"
```

### 1-b. 10.8.20.100（broker-b 新机器）

**在旧机器 10.7.9.117 上打包：**

```bash
tar czf /tmp/rocketmq_pim_pkg.tar.gz \
  -C /usr/local/rocketmq rocketmq-all-4.6.1-bin-release

scp /tmp/rocketmq_pim_pkg.tar.gz root@10.8.20.100:/tmp/
```

**在新机器 10.8.20.100 上执行：**

```bash
mkdir -p /usr/local/rocketmq
tar xzf /tmp/rocketmq_pim_pkg.tar.gz -C /usr/local/rocketmq/

ls /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqbroker

mkdir -p /rocketmq-data/data/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs

java -version && echo "JAVA_HOME=${JAVA_HOME}"
ss -tlnp | grep -E ":10911|:10912|:10909|:9876"
```

### 1-c. 10.8.20.101（broker-c 新机器）

**在旧机器 10.7.9.118 上打包：**

```bash
tar czf /tmp/rocketmq_pim_pkg.tar.gz \
  -C /usr/local/rocketmq rocketmq-all-4.6.1-bin-release

scp /tmp/rocketmq_pim_pkg.tar.gz root@10.8.20.101:/tmp/
```

**在新机器 10.8.20.101 上执行：**

```bash
mkdir -p /usr/local/rocketmq
tar xzf /tmp/rocketmq_pim_pkg.tar.gz -C /usr/local/rocketmq/

ls /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqbroker

mkdir -p /rocketmq-data/data/{commitlog,consumequeue,index,checkpoint,abort}
mkdir -p /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs

java -version && echo "JAVA_HOME=${JAVA_HOME}"
ss -tlnp | grep -E ":10911|:10912|:10909|:9876"
```

**Phase 1 Checklist**

- [ ] 10.8.20.47 RocketMQ 解压完成，`/rocketmq-data/data/` 目录已创建
- [ ] 10.8.20.100 RocketMQ 解压完成，`/rocketmq-data/data/` 目录已创建
- [ ] 10.8.20.101 RocketMQ 解压完成，`/rocketmq-data/data/` 目录已创建

---

## Phase 2：冷同步 store 数据（三组并行）

> 只同步 Master 的 store：`/rocketmq-data/data/`  
> Slave 的 `/rocketmq-data/data-01/` **不同步**

### 2-a. 在 10.7.8.119 上执行 → 同步到 10.8.20.47（broker-a）

```bash
# 免密已配，直接启动
echo "[$(date '+%F %T')] 开始同步 broker-a -> 10.8.20.47"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /rocketmq-data/data/ \
  root@10.8.20.47:/rocketmq-data/data/ \
  > /tmp/rsync_pim_broker_a_47.log 2>&1 &

echo "broker-a rsync started, PID=${!}"
```

### 2-b. 在 10.7.9.117 上执行 → 同步到 10.8.20.100（broker-b）

```bash
# 先配免密
ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa 2>/dev/null || true
ssh-copy-id root@10.8.20.100
ssh -o BatchMode=yes root@10.8.20.100 "echo 10.8.20.100 OK"

echo "[$(date '+%F %T')] 开始同步 broker-b -> 10.8.20.100"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /rocketmq-data/data/ \
  root@10.8.20.100:/rocketmq-data/data/ \
  > /tmp/rsync_pim_broker_b_100.log 2>&1 &

echo "broker-b rsync started, PID=${!}"
```

### 2-c. 在 10.7.9.118 上执行 → 同步到 10.8.20.101（broker-c）

```bash
# 先配免密
ssh-keygen -t rsa -N "" -f ~/.ssh/id_rsa 2>/dev/null || true
ssh-copy-id root@10.8.20.101
ssh -o BatchMode=yes root@10.8.20.101 "echo 10.8.20.101 OK"

echo "[$(date '+%F %T')] 开始同步 broker-c -> 10.8.20.101"

nohup rsync -avP \
  --bwlimit=102400 \
  --exclude="lock" \
  --exclude="abort" \
  -e "ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60" \
  /rocketmq-data/data/ \
  root@10.8.20.101:/rocketmq-data/data/ \
  > /tmp/rsync_pim_broker_c_101.log 2>&1 &

echo "broker-c rsync started, PID=${!}"
```

### 2-d. 查看进度

```bash
tail -5 /tmp/rsync_pim_broker_a_47.log    # 在 10.7.8.119
tail -5 /tmp/rsync_pim_broker_b_100.log   # 在 10.7.9.117
tail -5 /tmp/rsync_pim_broker_c_101.log   # 在 10.7.9.118

# rsync 完成后在新机器验证大小
# 在 10.8.20.47/100/101：du -sh /rocketmq-data/data/commitlog/
```

**Phase 2 Checklist**

- [ ] broker-a rsync 完成（log 末行含 total size）
- [ ] broker-b rsync 完成
- [ ] broker-c rsync 完成
- [ ] 新机器 `/rocketmq-data/data/commitlog/` 大小与旧机器（~42G）相近

---

## Phase 3：写 broker-slave.conf（新机器 Slave 模式）

> 新 Slave 统一用端口 **10911**（旧 Slave 的 10916 是旧集群历史配置，新机器不沿用）

### 3-a. 在 10.8.20.47（broker-a 新机器）执行

```bash
cat > /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf << 'EOF'
brokerClusterName=MqCloud-PimDatabus
brokerName=broker-a
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876
brokerIP1=10.8.20.47
listenPort=10911

storePathRootDir=/rocketmq-data/data
storePathCommitLog=/rocketmq-data/data/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.47 broker-slave.conf ===" \
  && cat /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf
```

### 3-b. 在 10.8.20.100（broker-b 新机器）执行

```bash
cat > /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf << 'EOF'
brokerClusterName=MqCloud-PimDatabus
brokerName=broker-b
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876
brokerIP1=10.8.20.100
listenPort=10911

storePathRootDir=/rocketmq-data/data
storePathCommitLog=/rocketmq-data/data/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.100 broker-slave.conf ===" \
  && cat /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf
```

### 3-c. 在 10.8.20.101（broker-c 新机器）执行

```bash
cat > /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf << 'EOF'
brokerClusterName=MqCloud-PimDatabus
brokerName=broker-c
brokerId=1
brokerRole=SLAVE
flushDiskType=ASYNC_FLUSH

namesrvAddr=10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876
brokerIP1=10.8.20.101
listenPort=10911

storePathRootDir=/rocketmq-data/data
storePathCommitLog=/rocketmq-data/data/commitlog

haHousekeepingInterval=20000
haSendHeartbeatInterval=1000
EOF

echo "=== 10.8.20.101 broker-slave.conf ===" \
  && cat /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf
```

**Phase 3 Checklist**

- [ ] 10.8.20.47 broker-slave.conf 写入，brokerName=broker-a，brokerIP1=10.8.20.47
- [ ] 10.8.20.100 broker-slave.conf 写入，brokerName=broker-b，brokerIP1=10.8.20.100
- [ ] 10.8.20.101 broker-slave.conf 写入，brokerName=broker-c，brokerIP1=10.8.20.101

---

## Phase 4：启动新 NameServer + Broker

> 三台新机器各执行一次，路径完全相同

### 4-1. 启动 NameServer（今天不切 DNS，仅启动备用）

```bash
# ====== 在 10.8.20.47 / 10.8.20.100 / 10.8.20.101 各执行 ======
export JAVA_HOME=/usr/local/jdk
# 若 JAVA_HOME 为空：export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))

mkdir -p /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs

nohup sh /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqnamesrv \
  > /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs/namesrv.log 2>&1 &

echo "NameServer PID=${!}"
sleep 5
grep -E "boot success|Exception" \
  /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs/namesrv.log | tail -5

# 成功日志：The Name Server boot success
```

### 4-2. 启动 Broker Slave

```bash
# ====== 在 10.8.20.47 / 10.8.20.100 / 10.8.20.101 各执行 ======
export JAVA_HOME=/usr/local/jdk
export JAVA_OPT_EXT="-server -Xms2g -Xmx2g -Xmn1g"

nohup sh /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqbroker \
  -c /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/conf/broker-slave.conf \
  > /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs/broker-startup.log 2>&1 &

echo "Broker PID=${!}"
sleep 8
tail -30 /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs/broker-startup.log

# 成功日志：The broker[broker-x, 10.8.20.xxx:10911] boot success
```

### 4-3. 验证三台 Slave 全部注册（在旧机器 10.7.8.119 上执行）

```bash
sh /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqadmin clusterList \
  -n "10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876"

# 正常输出应包含（BID=1 为新 Slave）：
# broker-a  BID=0  10.7.8.119   ...  （旧 Master）
# broker-a  BID=1  10.8.20.47   ...  ← 新加入 ✓
# broker-b  BID=0  10.7.9.117   ...
# broker-b  BID=1  10.8.20.100  ...  ← 新加入 ✓
# broker-c  BID=0  10.7.9.118   ...
# broker-c  BID=1  10.8.20.101  ...  ← 新加入 ✓
```

**Phase 4 Checklist**

- [ ] 10.8.20.47 NameServer 启动成功（boot success）
- [ ] 10.8.20.100 NameServer 启动成功
- [ ] 10.8.20.101 NameServer 启动成功
- [ ] 10.8.20.47 Broker 启动成功，clusterList 中以 BID=1 出现
- [ ] 10.8.20.100 Broker 启动成功，clusterList 中以 BID=1 出现
- [ ] 10.8.20.101 Broker 启动成功，clusterList 中以 BID=1 出现

---

## Phase 5：监控主从同步进度

```bash
# 在 10.7.8.119 执行（每 30 秒刷新）
watch -n 30 "sh /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/bin/mqadmin clusterList \
  -n '10.7.8.119:9876;10.7.9.117:9876;10.7.9.118:9876' 2>/dev/null"
```

**DIFF 列**持续下降，稳定在 `< 1MB` 即追平完成。

```bash
# 在新 Slave 上查看 HA 同步日志
grep -E "HAClient|haAddress|transfer" \
  /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs/broker.log | tail -20
```

**Phase 5 Checklist**

- [ ] broker-a DIFF 持续下降
- [ ] broker-b DIFF 持续下降
- [ ] broker-c DIFF 持续下降
- [ ] 三个 broker 组 DIFF 均 < 1MB，数据同步完成 ✓

---

## 今天完成后的状态

| 机器 | 角色 | 状态 |
|---|---|---|
| 10.7.8.119 | 旧 NS + broker-a Master + broker-c Slave | 继续服务，不动 |
| 10.7.9.117 | 旧 NS + broker-b Master + broker-a Slave | 继续服务，不动 |
| 10.7.9.118 | 旧 NS + broker-c Master + broker-b Slave | 继续服务，不动 |
| **10.8.20.47** | 新 NS（未切 DNS）+ broker-a Slave（新） | **新加入，持续追平** |
| **10.8.20.100** | 新 NS（未切 DNS）+ broker-b Slave（新） | **新加入，持续追平** |
| **10.8.20.101** | 新 NS（未切 DNS）+ broker-c Slave（新） | **新加入，持续追平** |

DNS 切换（pim.ns01/02/03.mid）、流量切换、旧机器下线为后续波次操作，今天不涉及。

---

## 常见问题排查

**Q：怎么区分一台机器上的两个 broker 进程？**  
→ 目录名含 `-01` 后缀的是 Slave（port 10916），不带 `-01` 的是 Master（port 10911）  
→ 今天只操作不带 `-01` 的那套（`rocketmq-all-4.6.1-bin-release`），store 在 `/rocketmq-data/data`

**Q：clusterList 中看不到新 Slave**  
→ 检查新机器防火墙是否放通 `10911`、`10909`、`10912` 端口  
→ 检查 broker-slave.conf 中 `namesrvAddr` 三个地址是否正确  
→ 查看 broker-startup.log 有无 exception

**Q：DIFF 值不下降**  
→ 检查旧 Master 与新 Slave 之间 `10912` 端口（HA 同步端口）是否可达  
→ 查看新 Slave 日志 `grep HAClient /usr/local/rocketmq/rocketmq-all-4.6.1-bin-release/logs/rocketmqlogs/broker.log`

**Q：新 NameServer 启动后，现有客户端会连上来吗？**  
→ 不会。DNS 未切换前，客户端的 NS 地址仍是旧 IP，新 NS 是独立启动，不影响现有集群。

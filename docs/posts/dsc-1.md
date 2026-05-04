---
title: 数据库系统概念读书笔记(1)
slug: dsc-1
date: 2026-05-04
description: 数据库系统概念序章
cover: ''
tags: []
categories: []
sticky: 0
publish: true
---

DBMS数据库管理系统，日常使用场景，联机事务，数据分析

数据模型分类

关系模型：数据和数据之间的关系

**实体-联系模型（E-R）：实体，基本对象集合和对象之间的联系**

半结构化数据模型：和E-R的本质区别是每个数据模型中属性的值类型是否唯一，半结构化数据中允许有多个值JSON/XML就是典型的半结构化数据

**基于对象的数据模型：OOP，面向对象思维**

数据抽象：物理层 -- 物理模式，逻辑层 --  逻辑模式，视图层 -- 子模式（MVC思想）

数据集合--instance

数据库语言分类：

DDL--数据库定义语言，定义，约束，引用的完整性，授权等

DML--数据库操纵语言(CRUD)

数据库设计：范式和非范式设计

查询处理器

DDL

DML 编译

存储管理器：权限和完整性管理器，事务管理器【并发控制管理器】，文件管理器，缓冲区管理器，数据文件，数据字典，索引

恢复管理器

```mermaid
flowchart TD
    U1["初学者用户<br/>终端用户、Web用户"]
    APPDEV["应用程序员"]
    U2["老练用户<br/>分析员"]
    DBA["数据库管理员"]

    UI["应用界面"]
    APP["应用程序"]
    QUERY["查询工具"]
    ADMIN["管理工具"]

    U1 -->|使用| UI
    APPDEV -->|写| APP
    U2 -->|使用| QUERY
    DBA -->|使用| ADMIN

    subgraph QP["查询处理器"]
        CODE["应用程序目标码"]
        COMP["编译器和链接器"]
        DML["DML查询"]
        DMLC["DML编译器和组织器"]
        DDL["DDL解释器"]
        ENGINE["查询执行引擎"]

        APP --> COMP
        COMP --> CODE
        CODE --> ENGINE
        COMP --> DML
        APP --> DML
        QUERY --> DML
        ADMIN --> DML
        ADMIN --> DDL
        DML --> DMLC
        DMLC --> ENGINE
    end

    subgraph SM["存储管理器"]
        BUF["缓冲区管理器"]
        FILE["文件管理器"]
        AUTH["授权和完整性管理器"]
        TX["事务管理器"]

        ENGINE --> BUF
        ENGINE --> FILE
        ENGINE --> AUTH
        ENGINE --> TX
    end

    subgraph DISK["磁盘存储"]
        DATA["数据"]
        IDX["索引"]
        DICT["数据字典"]
        STAT["统计数据"]
    end

    BUF --> DATA
    BUF --> IDX
    FILE --> DATA
    FILE --> IDX
    FILE --> DICT
    DDL --> DICT
    AUTH --> DICT
    DMLC --> DICT
    DMLC --> STAT
```

用户 -> app ->  db
用户 -> 客户端 -> app -> db

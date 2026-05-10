---
title: 数据库系统概念读书笔记(2)
slug: dsc-2
date: 2026-05-10
description: SQL部分
cover: ''
tags: []
categories: []
sticky: 0
publish: true
---

## 数据类型

char(n) 固定长度字符串类型，位数不足会追加

varchar(n)最大长度为n的可变字符串

int整数，依赖于当前机器整数的有限子集

smallint小整数

numeric(p,d)指定精度的定点数，总共p位数字+符号位，p位中的d位小数

real,double percision 依赖机器浮点数和双精度浮点数

float(n)至少有n位浮点数

null类型

```sql
-- 定义和变更
create table r (A1,D1 not null,primary key(An), foreign key(Am), references(Az));
drop table r;
alter table r add A D;
alter table r drop A;

-- 单关系查询
-- 查询
select name from table;
-- 强制去重
select distinct name from table;
-- 运算符匹配
select salary * 2 from table;
-- 多关系查询
select name from table1,table2 where table1.id = table2.id;
-- from产生笛卡尔积，应用where谓词，输出select属性投影

-- 附加运算
-- as,属性别名，或者表别名
select name as new_name from table
-- 字符运算
-- upper() || lower() || trim()
-- %任意字符串匹配 || _ 匹配单个字符串，%%全匹配，%xxx左匹配，xxx%右匹配 _ _ _,_ _ _%匹配三个和至少匹配三个
select name from table where A like 'aa%';
-- \ 转译特殊字符 \ \%


```

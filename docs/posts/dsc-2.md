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

-- *通配符

-- 列元素排序
-- a desc, b asc
select name from table where A = 'a' order by name;

-- where 子句谓词
-- 集合运算
-- 并集，字段数量必须一样，类型必须兼容，字段顺序一致
-- 已第一个查询的列名为准
(select A from tableA where A = 'a')
union
(select A from tableB where where A = 'b') 
-- 保留重复
(select A from tableA where A = 'a')
union all
(select A from tableB where where A = 'b') 

-- 交集运算
-- INTERSECT all 保留重复
SELECT id, CAST(name AS VARCHAR(50)) FROM table1
INTERSECT
SELECT id, CAST(amount AS VARCHAR(50)) FROM table2;
-- in or inner join
SELECT id, name FROM table1
WHERE (id, name) IN (
    SELECT id, name FROM table2
);

-- 差集运算
-- EXCEPT all 保留重复
SELECT id, name FROM table1
EXCEPT
SELECT id, name FROM table2;
-- left join
SELECT t1.id, t1.name
FROM table1 t1
LEFT JOIN table2 t2
ON t1.id = t2.id AND t1.name = t2.name
WHERE t2.id IS NULL;
-- not exists
SELECT * FROM R
WHERE NOT EXISTS (
SELECT 1 FROM S WHERE S.id = R.id AND S.name = R.name
);

-- null值，不是0，不是空字符串，不是false
-- and true and unknown -> unknown, （确定是false）false and unknown -> false,unknown and unknown -> unknown
-- or true or unknown -> true, （false或者true）false or unknown -> unknown, unknown or unknown -> unknown
-- not unknown -> unknown

-- 聚合函数
-- avg
-- min
-- max
-- sum
-- count

-- 分组，聚合+多属性分组
-- group by
-- having 分组后筛选
select name, avg(salary) as avg_salary from table group by name
having avg(salary) > 4200;
-- COUNT(*) 统计所有行；
-- COUNT(列) 只统计非 NULL；
-- SUM/AVG/MAX/MIN 忽略 NULL；
-- AVG(列) = SUM(列) / COUNT(列)；
-- 布尔条件统计用 SUM(CASE WHEN 条件 THEN 1 ELSE 0 END)；
-- COUNT(CASE WHEN 条件 THEN 1 END) 也可以；
-- COUNT(CASE WHEN 条件 THEN 1 ELSE 0 END) 是错的，会统计所有行。

-- 嵌套子查询
-- where谓词子句子查询
SELECT name
FROM student
WHERE class_id = (
    SELECT id
    FROM class
    WHERE class_name = '一班'
);

SELECT name
FROM student
WHERE class_id IN (
    SELECT id
    FROM class
    WHERE grade = '高一'
);

-- from子句临时表
SELECT t.class_id, t.avg_score
FROM (
    SELECT class_id, AVG(score) AS avg_score
    FROM student
    GROUP BY class_id
) t
WHERE t.avg_score > 80;
```

| 类型 | 返回结果 | 例子 |
| --- | --- | --- |
| 标量子查询 | 一行一列 | `SELECT AVG(score)` |
| 列子查询 | 多行一列 | `SELECT class_id FROM student` |
| 行子查询 | 一行多列 | `SELECT dept_id, salary` |
| 表子查询 | 多行多列 | `SELECT dept_id, AVG(score) GROUP BY dept_id` |

```sql
-- 子查询null
SELECT *
FROM student s
WHERE NOT EXISTS (
    SELECT 1
    FROM some_table t
    WHERE t.class_id = s.class_id
);

SELECT *
FROM employee
WHERE salary > ANY (
    SELECT salary
    FROM employee
    WHERE dept_id = 10
);

SELECT *
FROM employee
WHERE salary > ALL (
    SELECT salary
    FROM employee
    WHERE dept_id = 10
);
-- 一行多列
SELECT *
FROM employee
WHERE (dept_id, salary) = (
    SELECT dept_id, salary
    FROM employee
    WHERE id = 1
);
-- 多列多行
SELECT t.dept_id, t.avg_salary
FROM (
    SELECT dept_id, AVG(salary) AS avg_salary
    FROM employee
    GROUP BY dept_id
) t
WHERE t.avg_salary > 8000;

SELECT 
    e.name,
    e.salary,
    (
        SELECT AVG(e2.salary)
        FROM employee e2
        WHERE e2.dept_id = e.dept_id
    ) AS dept_avg_salary
FROM employee e;

-- 子查询和JOIN
SELECT name
FROM student
WHERE class_id IN (
    SELECT id
    FROM class
    WHERE grade = '高一'
);
SELECT s.name
FROM student s
JOIN class c ON s.class_id = c.id
WHERE c.grade = '高一';
```

| 写法 | 思维方式 |
| --- | --- |
| `IN` | 外层字段是否属于内层结果集合 |
| `EXISTS` | 是否存在满足条件的记录 |
| `NOT IN` | 不在某个集合中 |
| `NOT EXISTS` | 不存在满足条件的记录 |

**删除和更新**

```sql
delete from r where P
update table set a = a * 10 where P
```

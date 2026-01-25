package com.devsync.mapper;

import lombok.Data;

/**
 * SQL执行次数统计
 *
 * @author xiaolei
 */
@Data
public class SqlExecutionCount {

    private Integer sqlId;

    private Long count;
}

package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * SQL执行记录实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sql_execution_log")
public class SqlExecutionLog extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * SQL ID
     */
    private Integer sqlId;

    /**
     * 执行环境代码
     */
    private String env;

    /**
     * 执行时间
     */
    private LocalDateTime executedAt;

    /**
     * 执行人
     */
    private String executor;

    /**
     * 执行备注
     */
    private String remark;
}

package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 待执行SQL实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("pending_sql")
public class PendingSql extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 关联项目ID
     */
    private Integer projectId;

    /**
     * 关联迭代ID
     */
    private Integer iterationId;

    /**
     * SQL标题
     */
    private String title;

    /**
     * SQL内容
     */
    private String content;

    /**
     * 执行顺序
     */
    private Integer executionOrder;

    /**
     * 状态: pending/executed
     */
    private String status;

    /**
     * 执行时间
     */
    private LocalDateTime executedAt;

    /**
     * 执行环境
     */
    private String executedEnv;

    /**
     * 备注
     */
    private String remark;
}

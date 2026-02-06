package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 迭代-项目关联实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("iteration_project")
public class IterationProject extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 迭代ID
     */
    private Integer iterationId;

    /**
     * 项目ID
     */
    private Integer projectId;
}


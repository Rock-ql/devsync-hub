package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

/**
 * 迭代实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("iteration")
public class Iteration extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 关联项目ID
     */
    private Integer projectId;

    /**
     * 迭代名称
     */
    private String name;

    /**
     * 迭代描述
     */
    private String description;

    /**
     * 状态: planning/developing/testing/released
     */
    private String status;

    /**
     * 计划开始日期
     */
    private LocalDate startDate;

    /**
     * 计划结束日期
     */
    private LocalDate endDate;
}

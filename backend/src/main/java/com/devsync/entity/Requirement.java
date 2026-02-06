package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 需求实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("requirement")
public class Requirement extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 归属迭代ID
     */
    private Integer iterationId;

    /**
     * 需求名称
     */
    private String name;

    /**
     * 需求编号（如 XYGJ-1042）
     */
    private String requirementCode;

    /**
     * 当前环境（如 dev/smoke/prod）
     */
    private String environment;

    /**
     * 需求链接
     */
    private String link;

    /**
     * 需求状态
     */
    private String status;

    /**
     * 关联Git分支名称
     */
    private String branch;
}

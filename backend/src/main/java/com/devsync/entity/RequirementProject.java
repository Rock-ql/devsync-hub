package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 需求-项目关联实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("requirement_project")
public class RequirementProject extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 需求ID
     */
    private Integer requirementId;

    /**
     * 项目ID
     */
    private Integer projectId;
}

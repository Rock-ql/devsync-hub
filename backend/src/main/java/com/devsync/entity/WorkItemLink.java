package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 工作项关联实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("work_item_link")
public class WorkItemLink extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 工作项ID
     */
    private Integer workItemId;

    /**
     * 关联类型
     */
    private String linkType;

    /**
     * 关联ID
     */
    private Integer linkId;
}

package com.devsync.mapper;

import lombok.Data;

/**
 * 项目待执行SQL统计
 *
 * @author xiaolei
 */
@Data
public class ProjectPendingCount {

    private Integer projectId;

    private Long count;
}

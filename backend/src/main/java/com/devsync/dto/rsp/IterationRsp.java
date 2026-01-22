package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 迭代详情响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "迭代详情响应")
public class IterationRsp {

    @Schema(description = "迭代ID")
    private Integer id;

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "项目名称")
    private String projectName;

    @Schema(description = "迭代名称")
    private String name;

    @Schema(description = "迭代描述")
    private String description;

    @Schema(description = "状态: planning/developing/testing/released")
    private String status;

    @Schema(description = "状态描述")
    private String statusDesc;

    @Schema(description = "计划开始日期")
    private LocalDate startDate;

    @Schema(description = "计划结束日期")
    private LocalDate endDate;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "待执行SQL数量")
    private Integer pendingSqlCount;
}

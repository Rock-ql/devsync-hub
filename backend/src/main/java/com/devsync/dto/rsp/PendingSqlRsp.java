package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * SQL详情响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL详情响应")
public class PendingSqlRsp {

    @Schema(description = "SQL ID")
    private Integer id;

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "项目名称")
    private String projectName;

    @Schema(description = "迭代ID")
    private Integer iterationId;

    @Schema(description = "迭代名称")
    private String iterationName;

    @Schema(description = "SQL标题")
    private String title;

    @Schema(description = "SQL内容")
    private String content;

    @Schema(description = "执行顺序")
    private Integer executionOrder;

    @Schema(description = "状态: pending/partial/completed")
    private String status;

    @Schema(description = "状态描述")
    private String statusDesc;

    @Schema(description = "最近执行时间")
    private LocalDateTime executedAt;

    @Schema(description = "最近执行环境")
    private String executedEnv;

    @Schema(description = "备注")
    private String remark;

    @Schema(description = "已执行环境数")
    private Integer executedCount;

    @Schema(description = "环境总数")
    private Integer envTotal;

    @Schema(description = "环境执行列表")
    private List<PendingSqlEnvExecutionRsp> envExecutionList;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "关联的需求名称")
    private String linkedRequirementName;
}

package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

/**
 * 仪表盘概览响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "仪表盘概览响应")
public class DashboardRsp {

    @Schema(description = "项目总数")
    private Integer projectCount;

    @Schema(description = "活跃项目数（启用状态）")
    private Integer activeProjectCount;

    @Schema(description = "迭代总数")
    private Integer iterationCount;

    @Schema(description = "进行中的迭代数（开发中+测试中）")
    private Integer activeIterationCount;

    @Schema(description = "待执行SQL总数")
    private Integer pendingSqlCount;

    @Schema(description = "今日提交数")
    private Integer todayCommitCount;

    @Schema(description = "本周提交数")
    private Integer weekCommitCount;

    @Schema(description = "最近项目列表")
    private List<ProjectRsp> recentProjects;

    @Schema(description = "最近迭代列表")
    private List<IterationRsp> recentIterations;

    @Schema(description = "待执行SQL列表（按项目分组）")
    private List<ProjectPendingSqlRsp> pendingSqlByProject;

    /**
     * 按项目分组的待执行SQL
     */
    @Data
    @Schema(description = "按项目分组的待执行SQL")
    public static class ProjectPendingSqlRsp {

        @Schema(description = "项目ID")
        private Integer projectId;

        @Schema(description = "项目名称")
        private String projectName;

        @Schema(description = "待执行SQL数量")
        private Integer count;
    }
}

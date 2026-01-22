package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 项目详情响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "项目详情响应")
public class ProjectRsp {

    @Schema(description = "项目ID")
    private Integer id;

    @Schema(description = "项目名称")
    private String name;

    @Schema(description = "项目描述")
    private String description;

    @Schema(description = "GitLab 仓库地址")
    private String gitlabUrl;

    @Schema(description = "GitLab 项目ID")
    private Integer gitlabProjectId;

    @Schema(description = "默认分支")
    private String gitlabBranch;

    @Schema(description = "是否已配置GitLab")
    private Boolean gitlabConfigured;

    @Schema(description = "状态 1:启用 2:归档")
    private Integer state;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;

    @Schema(description = "迭代数量")
    private Integer iterationCount;

    @Schema(description = "待执行SQL数量")
    private Integer pendingSqlCount;
}

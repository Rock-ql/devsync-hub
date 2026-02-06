package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * GitLab 分支查询请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "GitLab 分支查询请求")
public class GitLabBranchReq {

    @Schema(description = "DevSync 项目ID，编辑模式下传入，用于从数据库获取已存储的 Token")
    private Integer id;

    @Schema(description = "GitLab 仓库地址")
    private String gitlabUrl;

    @Schema(description = "GitLab Access Token，新建项目时必填，编辑模式下可为空（从 DB 获取）")
    private String gitlabToken;

    @Schema(description = "GitLab 项目ID（可选）")
    private Integer gitlabProjectId;
}

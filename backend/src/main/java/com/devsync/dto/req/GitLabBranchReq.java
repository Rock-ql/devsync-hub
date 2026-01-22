package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * GitLab 分支查询请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "GitLab 分支查询请求")
public class GitLabBranchReq {

    @NotBlank(message = "GitLab 仓库地址不能为空")
    @Schema(description = "GitLab 仓库地址")
    private String gitlabUrl;

    @NotBlank(message = "GitLab Token不能为空")
    @Schema(description = "GitLab Access Token")
    private String gitlabToken;

    @Schema(description = "GitLab 项目ID（可选）")
    private Integer gitlabProjectId;
}

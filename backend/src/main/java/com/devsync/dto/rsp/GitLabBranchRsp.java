package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * GitLab 分支响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "GitLab 分支响应")
public class GitLabBranchRsp {

    @Schema(description = "分支名称")
    private String name;

    @Schema(description = "是否为默认分支")
    private Boolean defaultBranch;
}

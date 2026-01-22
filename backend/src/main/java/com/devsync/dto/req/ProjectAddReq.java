package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 项目新增请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "项目新增请求")
public class ProjectAddReq {

    @NotBlank(message = "项目名称不能为空")
    @Size(max = 100, message = "项目名称不能超过100个字符")
    @Schema(description = "项目名称")
    private String name;

    @Size(max = 1000, message = "项目描述不能超过1000个字符")
    @Schema(description = "项目描述")
    private String description;

    @Size(max = 500, message = "GitLab地址不能超过500个字符")
    @Schema(description = "GitLab 仓库地址")
    private String gitlabUrl;

    @Size(max = 500, message = "GitLab Token不能超过500个字符")
    @Schema(description = "GitLab Access Token")
    private String gitlabToken;

    @Schema(description = "GitLab 项目ID")
    private Integer gitlabProjectId;

    @Size(max = 100, message = "分支名称不能超过100个字符")
    @Schema(description = "默认分支")
    private String gitlabBranch;
}

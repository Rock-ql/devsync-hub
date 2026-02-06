package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 需求更新请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "需求更新请求")
public class RequirementUpdateReq {

    @NotNull(message = "需求ID不能为空")
    @Schema(description = "需求ID")
    private Integer id;

    @NotBlank(message = "需求名称不能为空")
    @Size(max = 500, message = "需求名称不能超过500个字符")
    @Schema(description = "需求名称")
    private String name;

    @Size(max = 50, message = "需求编号不能超过50个字符")
    @Schema(description = "需求编号，如 XYGJ-1042")
    private String requirementCode;

    @Size(max = 30, message = "环境标识不能超过30个字符")
    @Schema(description = "当前环境，如 dev/smoke/prod")
    private String environment;

    @Size(max = 1000, message = "需求链接不能超过1000个字符")
    @Schema(description = "需求链接")
    private String link;

    @Schema(description = "关联项目ID列表")
    private List<Integer> projectIds;

    @Schema(description = "需求状态")
    private String status;

    @Size(max = 200, message = "分支名称不能超过200个字符")
    @Schema(description = "关联Git分支名称")
    private String branch;
}

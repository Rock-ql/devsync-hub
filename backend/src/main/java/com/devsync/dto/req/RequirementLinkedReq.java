package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 查询已关联需求请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "查询已关联需求请求")
public class RequirementLinkedReq {

    @NotBlank(message = "关联类型不能为空")
    @Schema(description = "关联类型: sql/commit")
    private String linkType;

    @NotNull(message = "关联ID不能为空")
    @Schema(description = "关联目标ID，如SQL的ID")
    private Integer linkId;
}

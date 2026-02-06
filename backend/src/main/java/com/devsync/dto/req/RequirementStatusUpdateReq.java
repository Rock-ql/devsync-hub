package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 需求状态更新请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "需求状态更新请求")
public class RequirementStatusUpdateReq {

    @NotNull(message = "需求ID不能为空")
    @Schema(description = "需求ID")
    private Integer id;

    @NotBlank(message = "需求状态不能为空")
    @Schema(description = "需求状态")
    private String status;
}


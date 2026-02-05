package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 需求删除请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "需求删除请求")
public class RequirementDeleteReq {

    @NotNull(message = "需求ID不能为空")
    @Schema(description = "需求ID")
    private Integer id;
}

package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 需求列表请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "需求列表请求")
public class RequirementListReq {

    @NotNull(message = "迭代ID不能为空")
    @Schema(description = "归属迭代ID")
    private Integer iterationId;

    @Schema(description = "需求名称（模糊搜索）")
    private String keyword;
}

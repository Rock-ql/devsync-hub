package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 迭代列表请求
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "迭代列表请求")
public class IterationListReq extends PageReq {

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "迭代名称（模糊搜索）")
    private String name;

    @Schema(description = "状态: planning/developing/testing/released")
    private String status;
}

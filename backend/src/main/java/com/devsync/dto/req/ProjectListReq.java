package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 项目列表请求
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@Schema(description = "项目列表请求")
public class ProjectListReq extends PageReq {

    @Schema(description = "项目名称（模糊搜索）")
    private String name;

    @Schema(description = "状态 1:启用 2:归档")
    private Integer state;
}

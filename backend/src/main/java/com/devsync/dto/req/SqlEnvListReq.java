package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 环境列表请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "环境列表请求")
public class SqlEnvListReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;
}

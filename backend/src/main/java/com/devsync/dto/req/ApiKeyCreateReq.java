package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * API Key创建请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "API Key创建请求")
public class ApiKeyCreateReq {

    @NotBlank(message = "Key名称不能为空")
    @Size(max = 100, message = "Key名称不能超过100个字符")
    @Schema(description = "Key名称")
    private String name;
}

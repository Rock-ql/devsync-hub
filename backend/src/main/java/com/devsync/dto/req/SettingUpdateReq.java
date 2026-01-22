package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 系统设置更新请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "系统设置更新请求")
public class SettingUpdateReq {

    @NotBlank(message = "设置键不能为空")
    @Schema(description = "设置键")
    private String settingKey;

    @Schema(description = "设置值")
    private String settingValue;

    @Schema(description = "设置描述")
    private String description;
}

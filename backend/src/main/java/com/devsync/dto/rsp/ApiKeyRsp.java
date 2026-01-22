package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * API Key响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "API Key响应")
public class ApiKeyRsp {

    @Schema(description = "Key ID")
    private Integer id;

    @Schema(description = "Key名称")
    private String name;

    @Schema(description = "Key前缀（用于显示）")
    private String keyPrefix;

    @Schema(description = "完整Key（仅创建时返回）")
    private String fullKey;

    @Schema(description = "最后使用时间")
    private LocalDateTime lastUsedAt;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;
}

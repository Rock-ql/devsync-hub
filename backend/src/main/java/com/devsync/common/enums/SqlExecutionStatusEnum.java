package com.devsync.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * SQL多环境执行状态枚举
 *
 * @author xiaolei
 */
@Getter
@AllArgsConstructor
public enum SqlExecutionStatusEnum {

    PENDING("pending", "待执行"),
    PARTIAL("partial", "部分执行"),
    COMPLETED("completed", "全部完成");

    private final String code;
    private final String desc;

    /**
     * 根据code获取枚举
     */
    public static SqlExecutionStatusEnum getByCode(String code) {
        for (SqlExecutionStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}

package com.devsync.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * SQL执行状态枚举
 *
 * @author xiaolei
 */
@Getter
@AllArgsConstructor
public enum SqlStatusEnum {

    PENDING("pending", "待执行"),
    EXECUTED("executed", "已执行");

    private final String code;
    private final String desc;

    /**
     * 根据code获取枚举
     */
    public static SqlStatusEnum getByCode(String code) {
        for (SqlStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}

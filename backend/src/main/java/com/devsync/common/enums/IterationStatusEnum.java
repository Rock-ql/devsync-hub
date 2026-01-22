package com.devsync.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 迭代状态枚举
 *
 * @author xiaolei
 */
@Getter
@AllArgsConstructor
public enum IterationStatusEnum {

    PLANNING("planning", "规划中"),
    DEVELOPING("developing", "开发中"),
    TESTING("testing", "测试中"),
    RELEASED("released", "已上线");

    private final String code;
    private final String desc;

    /**
     * 根据code获取枚举
     */
    public static IterationStatusEnum getByCode(String code) {
        for (IterationStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}

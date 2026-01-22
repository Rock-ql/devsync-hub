package com.devsync.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 报告类型枚举
 *
 * @author xiaolei
 */
@Getter
@AllArgsConstructor
public enum ReportTypeEnum {

    DAILY("daily", "日报"),
    WEEKLY("weekly", "周报");

    private final String code;
    private final String desc;

    /**
     * 根据code获取枚举
     */
    public static ReportTypeEnum getByCode(String code) {
        for (ReportTypeEnum type : values()) {
            if (type.getCode().equals(code)) {
                return type;
            }
        }
        return null;
    }
}

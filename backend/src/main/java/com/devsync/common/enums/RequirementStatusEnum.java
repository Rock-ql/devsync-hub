package com.devsync.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Objects;

/**
 * 需求状态枚举
 *
 * @author xiaolei
 */
@Getter
@AllArgsConstructor
public enum RequirementStatusEnum {

    PRESENTED(0, "presented", "已宣讲"),
    PENDING_DEV(1, "pending_dev", "待研发"),
    DEVELOPING(2, "developing", "开发中"),
    INTEGRATING(3, "integrating", "联调中"),
    PENDING_TEST(4, "pending_test", "待测试"),
    TESTING(5, "testing", "测试中"),
    PENDING_ACCEPTANCE(6, "pending_acceptance", "待验收"),
    PENDING_RELEASE(7, "pending_release", "待上线"),
    RELEASED(8, "released", "已上线");

    /**
     * 排序序号（用于流转校验）
     */
    private final Integer order;

    private final String code;
    private final String desc;

    /**
     * 根据 code 获取枚举
     */
    public static RequirementStatusEnum getByCode(String code) {
        if (code == null) {
            return null;
        }
        for (RequirementStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }

    /**
     * 校验状态流转：只允许前进或后退一步
     *
     * @param fromCode 原状态
     * @param toCode   目标状态
     * @return 是否允许
     */
    public static boolean canTransfer(String fromCode, String toCode) {
        RequirementStatusEnum from = getByCode(fromCode);
        RequirementStatusEnum to = getByCode(toCode);

        if (from == null || to == null) {
            return false;
        }

        int diff = Math.abs(to.getOrder() - from.getOrder());
        return diff <= 1;
    }
}

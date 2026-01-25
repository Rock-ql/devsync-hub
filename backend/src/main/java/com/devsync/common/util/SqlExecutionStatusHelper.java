package com.devsync.common.util;

import com.devsync.common.enums.SqlExecutionStatusEnum;

/**
 * SQL执行状态计算工具
 *
 * @author xiaolei
 */
public final class SqlExecutionStatusHelper {

    private SqlExecutionStatusHelper() {
    }

    public static SqlExecutionStatusEnum calculate(Integer executedCount, Integer envTotal) {
        int executed = executedCount == null ? 0 : executedCount;
        int total = envTotal == null ? 0 : envTotal;
        if (total <= 0 || executed <= 0) {
            return SqlExecutionStatusEnum.PENDING;
        }
        if (executed >= total) {
            return SqlExecutionStatusEnum.COMPLETED;
        }
        return SqlExecutionStatusEnum.PARTIAL;
    }
}

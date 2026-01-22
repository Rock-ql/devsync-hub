package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;

/**
 * 日报周报实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "report")
public class Report extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 类型: daily/weekly
     */
    private String type;

    /**
     * 标题
     */
    private String title;

    /**
     * Markdown内容
     */
    private String content;

    /**
     * 起始日期
     */
    private LocalDate startDate;

    /**
     * 结束日期
     */
    private LocalDate endDate;

    /**
     * 提交记录摘要（JSON字符串）
     */
    private String commitSummary;
}

package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.ReportTemplate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

/**
 * 报告模板 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface ReportTemplateMapper extends BaseMapper<ReportTemplate> {

    /**
     * 获取默认模板
     *
     * @param type 类型
     * @return 默认模板
     */
    @Select("SELECT * FROM report_template WHERE type = #{type} AND is_default = true AND deleted_at IS NULL LIMIT 1")
    ReportTemplate getDefaultTemplate(String type);
}

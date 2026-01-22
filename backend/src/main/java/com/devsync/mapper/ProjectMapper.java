package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.Project;
import org.apache.ibatis.annotations.Mapper;

/**
 * 项目 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface ProjectMapper extends BaseMapper<Project> {
}

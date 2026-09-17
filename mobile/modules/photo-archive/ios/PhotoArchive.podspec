Pod::Spec.new do |s|
  s.name           = 'PhotoArchive'
  s.version        = '1.0.0'
  s.summary        = 'Persistent access to a user-selected photo archive'
  s.description    = 'Stores a security-scoped bookmark and coordinates archive reads and user-requested writes.'
  s.author         = 'Photo Day contributors'
  s.homepage       = 'https://github.com/polyakovin/daily-photos'
  s.platforms      = {
    :ios => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

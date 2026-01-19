import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "talktail",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    // 개발 모드: Metro 번들러에서 번들 로드
    let bundleURLProvider = RCTBundleURLProvider.sharedSettings()
    
    // 실기기 테스트를 위해 localhost 대신 Mac의 IP 주소 사용
    // Xcode에서 Scheme의 Arguments에 METRO_IP 환경 변수를 추가하거나
    // 여기서 직접 IP 주소를 설정할 수 있습니다
    // 예: bundleURLProvider.jsLocation = "192.168.0.23"
    
    // 기본적으로 RCTBundleURLProvider는 자동으로 감지하지만,
    // 실기기에서는 수동 설정이 필요할 수 있습니다
    return bundleURLProvider.jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}

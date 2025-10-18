import XCTest
@testable import OdysseyMacApp

final class OdysseyMacAppTests: XCTestCase {
    override func setUp() {
        super.setUp()
        APIEnvironment.reset()
    }

    override func tearDown() {
        APIEnvironment.reset()
        super.tearDown()
    }

    func testSpacingRawValuesMatchDesignGrid() {
        XCTAssertEqual(OdysseySpacing.xs.value, 8)
        XCTAssertEqual(OdysseySpacing.lg.value, 24)
    }

    func testAPIEnvironmentDefaultIsProduction() {
        XCTAssertEqual(APIEnvironment.current.baseURL, APIEnvironment.production.baseURL)
    }
}

import 'package:dio/dio.dart';
import 'package:gameshop_mobile/services/api_service.dart';

class RecordedApiRequest {
  final String method;
  final String path;
  final dynamic data;
  final Map<String, dynamic>? params;

  const RecordedApiRequest({
    required this.method,
    required this.path,
    this.data,
    this.params,
  });
}

/// Records exact request payloads and returns well-formed API envelopes.
class FakeApiClient implements ApiClient {
  final List<RecordedApiRequest> requests = [];
  final dynamic Function(String path)? responder;
  final DioException? error;

  FakeApiClient({this.responder, this.error});

  Response _respond(
    String method,
    String path, {
    dynamic data,
    Map<String, dynamic>? params,
  }) {
    requests.add(RecordedApiRequest(
      method: method,
      path: path,
      data: data,
      params: params,
    ));
    if (error != null) throw error!;
    final payload = responder?.call(path) ?? <String, dynamic>{};
    return Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': payload},
    );
  }

  @override
  Future<Response> get(String path, {Map<String, dynamic>? params}) async =>
      _respond('GET', path, params: params);

  @override
  Future<Response> post(String path, {dynamic data}) async =>
      _respond('POST', path, data: data);

  @override
  Future<Response> put(String path, {dynamic data}) async =>
      _respond('PUT', path, data: data);

  @override
  Future<Response> patch(String path, {dynamic data}) async =>
      _respond('PATCH', path, data: data);

  @override
  Future<Response> delete(String path) async => _respond('DELETE', path);
}

DioException testDioError({
  String path = '/test',
  int statusCode = 500,
  String message = 'Server unavailable',
}) {
  final requestOptions = RequestOptions(path: path);
  return DioException(
    requestOptions: requestOptions,
    type: DioExceptionType.badResponse,
    response: Response(
      requestOptions: requestOptions,
      statusCode: statusCode,
      data: {'message': message},
    ),
  );
}
